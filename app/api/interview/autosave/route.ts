import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { interviewAutosaves, interviewSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type TimerOptionId = '15' | '30' | 'unlimited';

const VALID_TIMER_OPTIONS: TimerOptionId[] = ['15', '30', 'unlimited'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = Number(body?.sessionId);
    const timerOption = body?.timerOption as TimerOptionId | undefined;

    if (!sessionId || Number.isNaN(sessionId)) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!timerOption || !VALID_TIMER_OPTIONS.includes(timerOption)) {
      return NextResponse.json({ error: 'timerOption is invalid' }, { status: 400 });
    }

    const [session] = await db
      .select({ id: interviewSessions.id })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Interview session not found' }, { status: 404 });
    }

    const secondsElapsed = typeof body?.secondsElapsed === 'number' && body.secondsElapsed > 0 ? Math.floor(body.secondsElapsed) : 0;
    const extensionCount = typeof body?.extensionCount === 'number' && body.extensionCount > 0 ? Math.floor(body.extensionCount) : 0;
    const secondsRemaining = typeof body?.secondsRemaining === 'number' ? Math.max(Math.floor(body.secondsRemaining), 0) : null;
    const updatedAt = body?.updatedAt ? new Date(body.updatedAt) : new Date();

    const messagesJson = JSON.stringify(Array.isArray(body?.messages) ? body.messages : []);
    const coverageJson = JSON.stringify(Array.isArray(body?.coverage) ? body.coverage : []);

    await db
      .insert(interviewAutosaves)
      .values({
        sessionId,
        timerOption,
        secondsRemaining,
        secondsElapsed,
        extensionCount,
        messagesJson,
        coverageJson,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: interviewAutosaves.sessionId,
        set: {
          timerOption,
          secondsRemaining,
          secondsElapsed,
          extensionCount,
          messagesJson,
          coverageJson,
          updatedAt,
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Autosave POST failed:', error);
    return NextResponse.json({ error: 'Failed to persist autosave' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionParam = searchParams.get('sessionId');
    const sessionId = sessionParam ? Number(sessionParam) : null;

    if (!sessionId || Number.isNaN(sessionId)) {
      return NextResponse.json({ error: 'sessionId query parameter is required' }, { status: 400 });
    }

    const [row] = await db
      .select()
      .from(interviewAutosaves)
      .where(eq(interviewAutosaves.sessionId, sessionId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Autosave not found' }, { status: 404 });
    }

    let messages: unknown = [];
    let coverage: unknown = [];

    try {
      messages = JSON.parse(row.messagesJson ?? '[]');
    } catch (error) {
      console.warn('Failed to parse autosave messages JSON:', error);
    }

    try {
      coverage = JSON.parse(row.coverageJson ?? '[]');
    } catch (error) {
      console.warn('Failed to parse autosave coverage JSON:', error);
    }

    return NextResponse.json({
      success: true,
      snapshot: {
        sessionId: row.sessionId,
        timerOption: row.timerOption as TimerOptionId,
        secondsRemaining: row.secondsRemaining,
        secondsElapsed: row.secondsElapsed ?? 0,
        extensionCount: row.extensionCount ?? 0,
        messages,
        coverage,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Autosave GET failed:', error);
    return NextResponse.json({ error: 'Failed to load autosave' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = Number(body?.sessionId);

    if (!sessionId || Number.isNaN(sessionId)) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    await db.delete(interviewAutosaves).where(eq(interviewAutosaves.sessionId, sessionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Autosave DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to clear autosave' }, { status: 500 });
  }
}
