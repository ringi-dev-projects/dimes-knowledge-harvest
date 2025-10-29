import { NextRequest, NextResponse } from 'next/server';
import { AzureOpenAI } from 'openai';
import { db } from '@/lib/db';
import { interviewSessions, qaTurns, knowledgeAtoms, topicTrees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TopicTree } from '@/lib/types';

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
});

interface KnowledgeAtom {
  topicId: string;
  type: 'procedure' | 'fact' | 'troubleshooting' | 'best_practice';
  title: string;
  content: string;
  sourceSpan?: string;
  confidence: number;
}

/**
 * Extract structured knowledge from interview transcripts using Azure OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get interview session
    const sessions = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId))
      .limit(1);

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: 'Interview session not found' },
        { status: 404 }
      );
    }

    const session = sessions[0];

    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: 'Interview must be completed before extraction' },
        { status: 400 }
      );
    }

    // Get transcript
    let messages: Array<{ role: string; content: string; timestamp: number }> = [];
    if (session.transcript) {
      try {
        messages = JSON.parse(session.transcript);
      } catch (error) {
        console.error('Failed to parse transcript:', error);
        return NextResponse.json(
          { error: 'Invalid transcript format' },
          { status: 400 }
        );
      }
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'No transcript available for this session' },
        { status: 400 }
      );
    }

    // Get topic tree for context
    let topicTree: TopicTree | null = null;
    if (session.topicTreeId) {
      const topicTreeRecords = await db
        .select()
        .from(topicTrees)
        .where(eq(topicTrees.id, session.topicTreeId))
        .limit(1);

      if (topicTreeRecords.length > 0) {
        topicTree = JSON.parse(topicTreeRecords[0].topicData);
      }
    }

    // Create transcript text
    const transcriptText = messages
      .map(m => `${m.role === 'assistant' ? 'Interviewer' : 'Expert'}: ${m.content}`)
      .join('\n\n');

    // Extract knowledge using Azure OpenAI
    const systemPrompt = `You are an expert at extracting structured knowledge from interview transcripts.
Your task is to analyze the interview and extract discrete knowledge atoms.

Each knowledge atom should be:
- Focused on a single piece of information
- Actionable and specific
- Properly categorized by type
- Linked to a topic from the topic tree

Types of knowledge atoms:
- procedure: Step-by-step instructions
- fact: Factual information (names, numbers, specifications)
- troubleshooting: Problem diagnosis and solutions
- best_practice: Recommended approaches and tips

${topicTree ? `Topic Tree Structure:\n${JSON.stringify(topicTree.topics.map(t => ({ id: t.id, name: t.name })), null, 2)}` : ''}

Return ONLY valid JSON in this format:
{
  "knowledgeAtoms": [
    {
      "topicId": "topic_id",
      "type": "procedure|fact|troubleshooting|best_practice",
      "title": "Brief title (5-10 words)",
      "content": "Detailed content",
      "sourceSpan": "Relevant quote from transcript",
      "confidence": 0.95
    }
  ]
}`;

    const userPrompt = `Interview Transcript:\n\n${transcriptText}\n\nExtract all knowledge atoms from this interview.`;

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Azure OpenAI');
    }

    // Parse response
    let extractionResult: { knowledgeAtoms: KnowledgeAtom[] };
    try {
      extractionResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Azure OpenAI returned invalid JSON format');
    }

    if (!extractionResult.knowledgeAtoms || !Array.isArray(extractionResult.knowledgeAtoms)) {
      throw new Error('Invalid knowledge atoms structure');
    }

    // Store knowledge atoms in database
    const now = new Date();
    const storedAtoms = [];

    for (const atom of extractionResult.knowledgeAtoms) {
      const [inserted] = await db.insert(knowledgeAtoms).values({
        sessionId: session.id,
        topicId: atom.topicId,
        type: atom.type,
        title: atom.title,
        content: atom.content,
        sourceSpan: atom.sourceSpan || null,
        confidence: atom.confidence,
        createdAt: now,
      }).returning();

      storedAtoms.push(inserted);
    }

    // Also extract Q&A pairs and store them
    const qaExtractionPrompt = `Extract question-answer pairs from this interview transcript.
For each Q&A pair, identify which topic it relates to.

Return ONLY valid JSON:
{
  "qaPairs": [
    {
      "topicId": "topic_id",
      "question": "The question asked",
      "answer": "The answer provided",
      "timestamp": ${messages[0]?.timestamp || Date.now()}
    }
  ]
}`;

    const qaResponse = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
      messages: [
        { role: 'system', content: qaExtractionPrompt },
        { role: 'user', content: transcriptText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const qaContent = qaResponse.choices[0]?.message?.content;
    if (qaContent) {
      try {
        const qaResult: { qaPairs: Array<{ topicId: string; question: string; answer: string; timestamp: number }> } = JSON.parse(qaContent);

        for (const pair of qaResult.qaPairs) {
          await db.insert(qaTurns).values({
            sessionId: session.id,
            topicId: pair.topicId,
            question: pair.question,
            answer: pair.answer,
            timestamp: new Date(pair.timestamp),
            speakerLabel: session.speakerName || null,
          });
        }
      } catch (error) {
        console.error('Failed to extract Q&A pairs:', error);
        // Continue even if Q&A extraction fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Knowledge extracted successfully',
      knowledgeAtoms: storedAtoms,
      atomsExtracted: storedAtoms.length,
    });
  } catch (error) {
    console.error('Error extracting knowledge:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract knowledge',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
