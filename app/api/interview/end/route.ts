import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { interviewSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, messages } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Update session with completion data
    await db
      .update(interviewSessions)
      .set({
        endedAt: new Date(),
        transcript: JSON.stringify(messages || []),
        status: 'completed',
      })
      .where(eq(interviewSessions.id, sessionId));

    return NextResponse.json({
      success: true,
      message: 'Interview saved successfully',
      sessionId,
    });
  } catch (error) {
    console.error('Error ending interview:', error);
    return NextResponse.json(
      {
        error: 'Failed to save interview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
