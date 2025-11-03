import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { coverageScores, coverageEvidence, topicTrees } from '@/lib/db/schema';
import { CoverageMetrics, CoverageEvidenceSummary, TopicTree } from '@/lib/types';
import { eq } from 'drizzle-orm';

// Mock data for demo purposes
const mockMetrics: CoverageMetrics[] = [
  {
    topicId: 'products',
    topicName: 'Products & Services',
    targetQuestions: 15,
    answeredQuestions: 12,
    coveragePercent: 80,
    confidence: 85,
    nextQuestions: [
      'What are the warranty terms for each product line?',
      'How do you handle custom product requests?',
      'What is the pricing structure for bulk orders?',
    ],
  },
  {
    topicId: 'processes',
    topicName: 'Manufacturing Processes',
    targetQuestions: 20,
    answeredQuestions: 18,
    coveragePercent: 90,
    confidence: 92,
    nextQuestions: [
      'What are the backup procedures if the main line fails?',
      'How do you handle process deviations?',
    ],
  },
  {
    topicId: 'equipment',
    topicName: 'Equipment & Machinery',
    targetQuestions: 12,
    answeredQuestions: 8,
    coveragePercent: 67,
    confidence: 70,
    nextQuestions: [
      'What is the preventive maintenance schedule?',
      'Which parts need regular replacement?',
      'What are the critical machine parameters?',
      'How do you troubleshoot common equipment failures?',
    ],
  },
  {
    topicId: 'suppliers',
    topicName: 'Suppliers & Vendors',
    targetQuestions: 10,
    answeredQuestions: 5,
    coveragePercent: 50,
    confidence: 60,
    nextQuestions: [
      'Who are the backup suppliers for critical materials?',
      'What are the lead times for each supplier?',
      'How do you qualify new suppliers?',
      'What are the payment terms?',
      'How do you handle supplier quality issues?',
    ],
  },
  {
    topicId: 'safety',
    topicName: 'Safety & Compliance',
    targetQuestions: 18,
    answeredQuestions: 16,
    coveragePercent: 89,
    confidence: 95,
    nextQuestions: [
      'What are the emergency evacuation procedures?',
      'How often are safety drills conducted?',
    ],
  },
  {
    topicId: 'quality',
    topicName: 'Quality Control',
    targetQuestions: 14,
    answeredQuestions: 10,
    coveragePercent: 71,
    confidence: 78,
    nextQuestions: [
      'What are the acceptance criteria for final inspection?',
      'How do you handle customer quality complaints?',
      'What is the process for root cause analysis?',
      'How do you track quality metrics over time?',
    ],
  },
  {
    topicId: 'troubleshooting',
    topicName: 'Troubleshooting & Problem Solving',
    targetQuestions: 16,
    answeredQuestions: 7,
    coveragePercent: 44,
    confidence: 55,
    nextQuestions: [
      'What are the most common production issues?',
      'How do you diagnose material defects?',
      'What tools are used for troubleshooting?',
      'Who should be contacted for different types of issues?',
      'How do you document and share solutions?',
    ],
  },
  {
    topicId: 'onboarding',
    topicName: 'Employee Onboarding',
    targetQuestions: 8,
    answeredQuestions: 6,
    coveragePercent: 75,
    confidence: 80,
    nextQuestions: [
      'What is the typical onboarding timeline?',
      'How do you evaluate new employee progress?',
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const useMock = searchParams.get('mock') === 'true';
    const companyId = searchParams.get('companyId');

    if (useMock) {
      return NextResponse.json({
        success: true,
        metrics: mockMetrics,
      });
    }

    let metrics: CoverageMetrics[] = [];

    if (companyId) {
      const companyIdNumber = parseInt(companyId, 10);
      if (Number.isNaN(companyIdNumber)) {
        return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 });
      }

      const [topicTreeRow] = await db
        .select()
        .from(topicTrees)
        .where(eq(topicTrees.companyId, companyIdNumber))
        .limit(1);

      const topicsMap = new Map<string, { name: string; targets: Array<{ id: string; q: string }> }>();

      if (topicTreeRow) {
        try {
          const topicTree: TopicTree = JSON.parse(topicTreeRow.topicData);
          const traverse = (nodes: TopicTree['topics']) => {
            nodes.forEach((node) => {
              topicsMap.set(node.id, {
                name: node.name,
                targets: node.targets ?? [],
              });
              if (node.children) {
                traverse(node.children);
              }
            });
          };
          traverse(topicTree.topics);
        } catch (error) {
          console.warn('Failed to parse topic tree while building coverage metrics:', error);
        }
      }

      const [scores, evidenceRows] = await Promise.all([
        db.select().from(coverageScores).where(eq(coverageScores.companyId, companyIdNumber)),
        db
          .select()
          .from(coverageEvidence)
          .where(eq(coverageEvidence.companyId, companyIdNumber)),
      ]);

      metrics = scores.map((score) => {
        const topicMeta = topicsMap.get(score.topicId);
        const topicEvidence = evidenceRows
          .filter((row) => row.topicId === score.topicId)
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });

        const evidenceSummary: CoverageEvidenceSummary[] = topicEvidence.slice(0, 5).map((row) => ({
          id: row.id,
          evidenceType: (row.evidenceType as CoverageEvidenceSummary['evidenceType']) ?? 'manual_note',
          confidence: row.confidence ?? 0,
          excerpt: row.excerpt ?? null,
          targetId: row.targetId ?? undefined,
          knowledgeAtomId: row.knowledgeAtomId ?? undefined,
          qaTurnId: row.qaTurnId ?? undefined,
          createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }));

        const unansweredTargets = (topicMeta?.targets ?? [])
          .filter((target) => !topicEvidence.some((row) => row.targetId === target.id))
          .map((target) => target.q)
          .slice(0, 5);

        return {
          topicId: score.topicId,
          topicName: topicMeta?.name ?? score.topicId,
          targetQuestions: score.targetQuestions,
          answeredQuestions: score.answeredQuestions,
          coveragePercent: score.coveragePercent,
          confidence: Math.round((score.confidence ?? 0) * 100),
          nextQuestions: unansweredTargets,
          evidenceSummary,
        } satisfies CoverageMetrics;
      });
    }

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Error fetching coverage metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coverage metrics' },
      { status: 500 }
    );
  }
}
