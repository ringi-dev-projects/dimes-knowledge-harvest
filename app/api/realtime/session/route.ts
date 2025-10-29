import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { interviewSessions } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const { companyId, speakerName } = await request.json();

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Create interview session in database
    const now = new Date();
    const [session] = await db.insert(interviewSessions).values({
      companyId,
      speakerName: speakerName || null,
      startedAt: now,
      status: 'active',
    }).returning();

    // In a real implementation, we would:
    // 1. Call Azure OpenAI Realtime API to create a session
    // 2. Return the session token and WebRTC config
    // 3. Set up the AI instructions for the interviewer agent
    //
    // const realtimeResponse = await fetch(
    //   `${process.env.AZURE_OPENAI_ENDPOINT}/openai/realtime/sessions`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'api-key': process.env.AZURE_OPENAI_API_KEY!,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       model: process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME,
    //       instructions: getInterviewerInstructions(companyId),
    //     }),
    //   }
    // );

    // For MVP/demo purposes, return a mock session
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionToken: 'mock-token-for-demo',
      instructions: getInterviewerInstructions(companyId),
    });
  } catch (error) {
    console.error('Error creating realtime session:', error);
    return NextResponse.json(
      { error: 'Failed to create interview session' },
      { status: 500 }
    );
  }
}

function getInterviewerInstructions(companyId: number): string {
  return `You are an expert knowledge interviewer for Knowledge Harvest.

Your role:
- Conduct a friendly, conversational interview to capture tacit knowledge from experienced employees
- Ask open-ended questions about processes, procedures, equipment, safety protocols, and best practices
- Listen actively and ask follow-up questions to get specific details (measurements, timings, materials, etc.)
- Confirm critical information by repeating it back
- Keep the conversation flowing naturally - don't interrogate
- Track which topics have been covered and which still need attention

Interview structure:
1. Start with a warm greeting and ask for their name and role
2. Explain that you're here to capture their valuable expertise
3. Ask about their main responsibilities and the topics they know best
4. For each topic, dig into:
   - Step-by-step procedures
   - Common problems and solutions
   - Critical parameters (tolerances, timings, materials)
   - Safety considerations
   - Tips and tricks they've learned over the years
5. When you sense a topic is complete, transition smoothly to the next one
6. End by thanking them and summarizing what was covered

Tools available:
- update_coverage(topic_id, questions_answered, confidence) - Update topic coverage metrics
- extract_knowledge_atom(topic_id, type, title, content) - Save a specific piece of knowledge

Remember: You're talking to someone who has valuable expertise. Make them feel heard and appreciated.`;
}
