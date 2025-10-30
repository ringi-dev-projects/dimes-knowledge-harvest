import { NextRequest, NextResponse } from 'next/server';
import { AzureOpenAI } from 'openai';
import { db } from '@/lib/db';
import { companies, topicTrees } from '@/lib/db/schema';
import { TopicTree } from '@/lib/types';
import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
});

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeHarvest/1.0)',
      },
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style, nav, footer').remove();

    // Get text content
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // Limit to first 3000 characters to avoid token limits
    return text.substring(0, 3000);
  } catch (error) {
    console.error('Error fetching website:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      url,
      companyName,
      description,
      focusArea,
      companyId: incomingCompanyId,
      mode = 'new',
      existingTopicTree,
      locale,
    } = await request.json();

    const requestedLocale = typeof locale === 'string' ? locale : 'ja';
    const targetLanguage = requestedLocale === 'en' ? 'English' : 'Japanese';

    const trimmedDescription = (description || '').trim();
    const trimmedFocusArea = (focusArea || '').trim();

    if (!trimmedDescription) {
      return NextResponse.json(
        { error: 'A short description is required to tailor the topic map.' },
        { status: 400 }
      );
    }

    let resolvedCompanyId: number | null = null;
    let resolvedCompanyName = (companyName || '').trim();
    let resolvedUrl = (url || '').trim();
    let existingCompanyRecord: typeof companies.$inferSelect | null = null;

    if (incomingCompanyId) {
      const [existingCompany] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, incomingCompanyId))
        .limit(1);

      if (!existingCompany) {
        return NextResponse.json(
          { error: 'Unable to find the existing company record. Refresh and try again.' },
          { status: 404 }
        );
      }

      existingCompanyRecord = existingCompany;
      resolvedCompanyId = existingCompany.id;
      if (!resolvedCompanyName) {
        resolvedCompanyName = existingCompany.name;
      }
      if (!resolvedUrl) {
        resolvedUrl = existingCompany.url ?? '';
      }
    }

    if (!resolvedCompanyName) {
      return NextResponse.json(
        { error: 'Company name is required to seed a topic tree.' },
        { status: 400 }
      );
    }

    // Fetch website content if URL provided
    let websiteContent = '';
    if (url) {
      websiteContent = await fetchWebsiteContent(url);
    }

    // Create prompt for topic tree generation
    let existingTopicsSnippet = '';
    if (existingTopicTree && typeof existingTopicTree === 'object') {
      try {
        existingTopicsSnippet = JSON.stringify(
          {
            topics: (existingTopicTree as TopicTree).topics?.slice(0, 6),
          },
          null,
          2
        ).slice(0, 4000);
      } catch (error) {
        console.warn('Failed to serialize existing topic tree snippet:', error);
      }
    }

    const systemPrompt = `You are a knowledge graph architect generating a compact, interview-ready topic tree for ${resolvedCompanyName}.
Keep the structure lean:
- Aim for 4 to 6 primary topics.
- Each topic may include up to 3 subtopics (children) only where they add clarity.
- Provide 2-3 target questions per topic and mark critical ones with required=true.
- Use weight values from 1-5 to signal priority (5 = highest).
- Avoid duplicating topics that already exist; refine or extend them with sharper prompts instead.
Write all topic names, descriptions, and question prompts in ${targetLanguage}.
${mode === 'extend' && existingTopicsSnippet ? `\nExisting topic structure (for reference only, do not repeat verbatim):\n${existingTopicsSnippet}\n` : ''}

Return ONLY valid JSON in this exact format:
{
  "company": "Company Name",
  "topics": [
    {
      "id": "unique_id",
      "name": "Topic Name",
      "weight": 5,
      "targets": [
        {"id": "t1", "q": "Specific question?", "required": true},
        {"id": "t2", "q": "Another question?", "required": false}
      ],
      "children": []
    }
  ]
}`;

    const userPromptLines = [
      `Company: ${resolvedCompanyName}`,
      trimmedDescription ? `Description: ${trimmedDescription}` : null,
      trimmedFocusArea
        ? `Priority focus area: ${trimmedFocusArea} (emphasize this while keeping the structure balanced)`
        : null,
      websiteContent ? `Website Content:\n${websiteContent}\n` : null,
      mode === 'extend' && existingTopicsSnippet
        ? 'Please extend or refine the existing map with a concise set of new topics or sharper prompts.'
        : 'Please generate a fresh, concise topic tree to kick off interviews.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const userPrompt = `${userPromptLines}

Return the topic tree now.`;

    // Call Azure OpenAI with structured outputs
    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Azure OpenAI');
    }

    // Parse and validate JSON response
    let topicTree: TopicTree;
    try {
      topicTree = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Azure OpenAI returned invalid JSON format');
    }

    // Validate topic tree structure
    if (!topicTree.company || !Array.isArray(topicTree.topics)) {
      console.error('Invalid topic tree structure:', topicTree);
      throw new Error('Topic tree has invalid structure');
    }

    if (topicTree.topics.length === 0) {
      throw new Error('No topics generated. Please provide more detailed company information.');
    }

    // Store in database
    const now = new Date();

    if (existingCompanyRecord) {
      await db
        .update(companies)
        .set({
          name: resolvedCompanyName,
          url: resolvedUrl || existingCompanyRecord.url,
          description: trimmedDescription || existingCompanyRecord.description,
        })
        .where(eq(companies.id, existingCompanyRecord.id));
      resolvedCompanyId = existingCompanyRecord.id;
    } else {
      const [company] = await db
        .insert(companies)
        .values({
          name: resolvedCompanyName,
          url: resolvedUrl || null,
          description: trimmedDescription,
          createdAt: now,
        })
        .returning();
      resolvedCompanyId = company.id;
    }

    await db.insert(topicTrees).values({
      companyId: resolvedCompanyId!,
      topicData: JSON.stringify(topicTree),
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      topicTree,
      companyId: resolvedCompanyId,
    });
  } catch (error) {
    console.error('Error generating topic tree:', error);

    // Provide detailed error messages
    let errorMessage = 'Failed to generate topic tree';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 }
    );
  }
}
