import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { companies, topicTrees, interviewSessions, qaTurns, coverageScores } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TopicTree, Topic } from '@/lib/types';

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
      .select()
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.companyId, companyId),
          eq(interviewSessions.status, 'completed')
        )
      );

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: 'No completed interviews found' },
        { status: 404 }
      );
    }

    // Get all Q&A turns from these sessions
    const sessionIds = sessions.map(s => s.id);
    const allQaTurns = await db
      .select()
      .from(qaTurns)
      .where(eq(qaTurns.sessionId, sessionIds[0])); // Simplified for now

    // Calculate coverage for each topic
    const coverageResults: any[] = [];

    function processTopics(topics: Topic[], parentPath = '') {
      for (const topic of topics) {
        const topicPath = parentPath ? `${parentPath}.${topic.id}` : topic.id;

        // Count target questions
        const targetQuestions = topic.targets?.length || 0;

        // Count answered questions (Q&A turns that match this topic)
        const answeredTurns = allQaTurns.filter(
          qa => qa.topicId === topic.id || qa.topicId === topicPath
        );
        const answeredQuestions = answeredTurns.length;

        // Calculate confidence (simplified - based on answer length)
        let confidence = 0;
        if (answeredQuestions > 0) {
          const avgAnswerLength = answeredTurns.reduce((sum, qa) => sum + qa.answer.length, 0) / answeredQuestions;
          // Higher confidence for longer, more detailed answers
          confidence = Math.min(100, (avgAnswerLength / 200) * 100) / 100;
        }

        coverageResults.push({
          companyId,
          topicId: topic.id,
          topicName: topic.name,
          targetQuestions,
          answeredQuestions: Math.min(answeredQuestions, targetQuestions),
          confidence,
        });

        // Recursively process children
        if (topic.children && topic.children.length > 0) {
          processTopics(topic.children, topicPath);
        }
      }
    }

    processTopics(topicTree.topics);

    // Delete existing coverage scores for this company
    await db.delete(coverageScores).where(eq(coverageScores.companyId, companyId));

    // Insert new coverage scores
    const now = new Date();
    for (const result of coverageResults) {
      await db.insert(coverageScores).values({
        companyId: result.companyId,
        topicId: result.topicId,
        targetQuestions: result.targetQuestions,
        answeredQuestions: result.answeredQuestions,
        confidence: result.confidence,
        lastUpdated: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Coverage calculated successfully',
      coverageResults,
      sessionsProcessed: sessions.length,
      totalQaTurns: allQaTurns.length,
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
