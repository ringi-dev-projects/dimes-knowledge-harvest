import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { topicTrees, interviewSessions, coverageScores, coverageEvidence } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { TopicTree, Topic, CoverageEvidenceSummary } from '@/lib/types';

/**
 * Calculate coverage scores for a company based on interview data
 * This endpoint processes interview transcripts and matches Q&A to topic targets
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId } = await request.json();

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Get company's topic tree
    const topicTreeRecords = await db
      .select()
      .from(topicTrees)
      .where(eq(topicTrees.companyId, companyId))
      .limit(1);

    if (topicTreeRecords.length === 0) {
      return NextResponse.json(
        { error: 'No topic tree found for this company' },
        { status: 404 }
      );
    }

    const topicTree: TopicTree = JSON.parse(topicTreeRecords[0].topicData);

    // Get all completed interview sessions for this company
    const sessions = await db
      .select({ id: interviewSessions.id })
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.companyId, companyId),
          eq(interviewSessions.status, 'completed')
        )
      );

    const sessionIds = sessions.map((session) => session.id);

    const evidenceRows = await db
      .select()
      .from(coverageEvidence)
      .where(eq(coverageEvidence.companyId, companyId));

    const now = new Date();
    const topicMap = new Map<string, Topic>();

    const collectTopics = (topics: Topic[]) => {
      topics.forEach((topic) => {
        topicMap.set(topic.id, topic);
        if (topic.children) {
          collectTopics(topic.children);
        }
      });
    };

    collectTopics(topicTree.topics);

    await db.delete(coverageScores).where(eq(coverageScores.companyId, companyId));

    const coverageResults: any[] = [];

    for (const [topicId, topic] of topicMap.entries()) {
      const topicTargets = topic.targets ?? [];
      const topicEvidence = evidenceRows.filter((row) => row.topicId === topicId);
      const uniqueTargetIds = new Set(
        topicEvidence
          .map((row) => row.targetId)
          .filter((value): value is string => Boolean(value))
      );

      const targetQuestions = topicTargets.length;
      let answeredQuestions = uniqueTargetIds.size;

      if (answeredQuestions === 0 && targetQuestions > 0) {
        answeredQuestions = Math.min(topicEvidence.length, targetQuestions);
      }

      let coveragePercent = 0;
      if (targetQuestions > 0) {
        coveragePercent = Math.min(100, Math.round((answeredQuestions / targetQuestions) * 100));
      } else if (topicEvidence.length > 0) {
        coveragePercent = 100;
      }

      const confidence = topicEvidence.length > 0
        ? topicEvidence.reduce((sum, row) => sum + (row.confidence ?? 0), 0) / topicEvidence.length
        : 0;

      const evidenceCount = topicEvidence.length;
      const lastEvidenceAt = topicEvidence.reduce<Date | null>((latest, row) => {
        if (!row.createdAt) {
          return latest;
        }
        const created = new Date(row.createdAt);
        if (!latest || created > latest) {
          return created;
        }
        return latest;
      }, null);

      const remainingTargets = topicTargets.filter((target) => !uniqueTargetIds.has(target.id)).map((target) => target.q).slice(0, 5);

      coverageResults.push({
        companyId,
        topicId,
        targetQuestions,
        answeredQuestions,
        coveragePercent,
        confidence,
        evidenceCount,
        lastEvidenceAt,
        nextQuestions: remainingTargets,
      });

      await db.insert(coverageScores).values({
        companyId,
        topicId,
        targetQuestions,
        answeredQuestions,
        coveragePercent,
        confidence,
        evidenceCount,
        lastEvidenceAt,
        lastUpdated: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Coverage calculated successfully',
      coverageResults,
      sessionsProcessed: sessionIds.length,
      totalEvidence: evidenceRows.length,
    });
  } catch (error) {
    console.error('Error calculating coverage:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate coverage',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
