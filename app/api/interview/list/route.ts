import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { interviewSessions, knowledgeAtoms } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import type { InterviewMessage } from '@/lib/types';

type InterviewSummary = {
  id: number;
  companyId: number;
  speakerName: string | null;
  startedAt: string;
  endedAt: string | null;
  status: string;
  durationSeconds: number | null;
  messageCount: number;
  knowledgeAtomCount: number;
  audioUrl: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const companyIdParam = request.nextUrl.searchParams.get('companyId');

    if (!companyIdParam) {
      return NextResponse.json(
        { error: 'companyId query parameter is required' },
        { status: 400 }
      );
    }

    const companyId = Number(companyIdParam);
    if (Number.isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId must be a number' },
        { status: 400 }
      );
    }

    const sessions = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.companyId, companyId))
      .orderBy(desc(interviewSessions.startedAt))
      .limit(12);

    const summaries: InterviewSummary[] = [];

    for (const session of sessions) {
      const startedAt = session.startedAt ? new Date(session.startedAt) : null;
      const endedAt = session.endedAt ? new Date(session.endedAt) : null;
      const durationSeconds =
        startedAt && endedAt ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000) : null;

      let messageCount = 0;
      if (session.transcript) {
        try {
          const parsed = JSON.parse(session.transcript) as InterviewMessage[];
          if (Array.isArray(parsed)) {
            messageCount = parsed.length;
          }
        } catch (error) {
          console.warn('Failed to parse transcript for session', session.id, error);
        }
      }

      let knowledgeAtomCount = 0;
      try {
        const [countRow] = await db
          .select({ value: sql<number>`COUNT(*)` })
          .from(knowledgeAtoms)
          .where(eq(knowledgeAtoms.sessionId, session.id));
        knowledgeAtomCount = countRow?.value ?? 0;
      } catch (error) {
        console.warn('Failed to count knowledge atoms for session', session.id, error);
      }

      summaries.push({
        id: session.id,
        companyId: session.companyId,
        speakerName: session.speakerName,
        startedAt: startedAt ? startedAt.toISOString() : new Date().toISOString(),
        endedAt: endedAt ? endedAt.toISOString() : null,
        status: session.status,
        durationSeconds,
        messageCount,
        knowledgeAtomCount,
        audioUrl: session.audioUrl ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      interviews: summaries,
    });
  } catch (error) {
    console.error('Failed to list interview sessions:', error);
    return NextResponse.json(
      { error: 'Failed to load interview sessions' },
      { status: 500 }
    );
  }
}
