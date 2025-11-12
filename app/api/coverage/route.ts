import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { coverageScores, coverageEvidence, topicTrees } from '@/lib/db/schema';
import { CoverageMetrics, CoverageEvidenceSummary, TopicTree } from '@/lib/types';
import { eq } from 'drizzle-orm';

// Mock data for demo purposes
const mockMetrics: CoverageMetrics[] = [
  {
    topicId: 'company_overview',
    topicName: '企業理解と戦略方針',
    targetQuestions: 12,
    answeredQuestions: 10,
    coveragePercent: 83,
    confidence: 88,
    nextQuestions: [
      'FY25の重点投資に対する進捗はどの指標で測定しますか？',
      '経営ダッシュボードに連携されるデータソースは何ですか？',
      '各戦略ピラーの責任者は誰で、レビュー頻度はどれくらいですか？',
    ],
  },
  {
    topicId: 'mission_values',
    topicName: 'ミッション・バリュー・カルチャー',
    targetQuestions: 10,
    answeredQuestions: 9,
    coveragePercent: 90,
    confidence: 93,
    nextQuestions: [
      'バリュー体現は評価・昇格プロセスのどこに組み込まれていますか？',
      '価値観を祝う社内儀式やチャンネルは何ですか？',
    ],
  },
  {
    topicId: 'product_primer',
    topicName: 'プロダクト/プラットフォーム入門',
    targetQuestions: 18,
    answeredQuestions: 12,
    coveragePercent: 67,
    confidence: 75,
    nextQuestions: [
      '標準的な製品デモのストーリーラインはどう構成されていますか？',
      'スプリントごとのバックログ優先順位はどの指標で決めますか？',
      '参照アーキテクチャやADRはどこで閲覧できますか？',
      '主要ワークフローのSLAはどのように定義されていますか？',
    ],
  },
  {
    topicId: 'customer_insights',
    topicName: '顧客セグメントとVoC',
    targetQuestions: 14,
    answeredQuestions: 8,
    coveragePercent: 57,
    confidence: 62,
    nextQuestions: [
      'エンタープライズ顧客のオンボーディング体験はどのような旅路ですか？',
      '各ペルソナにとっての健全な採用指標は何ですか？',
      'ハイタッチ顧客のエスカレーション階層はどう定義されていますか？',
    ],
  },
  {
    topicId: 'org_map',
    topicName: '組織構造と主要コンタクト',
    targetQuestions: 11,
    answeredQuestions: 7,
    coveragePercent: 64,
    confidence: 70,
    nextQuestions: [
      '部門ごとのツール申請承認フローは誰が握っていますか？',
      'インシデント対応の最新RACIはどこで更新されていますか？',
      '社内ギルドやコミュニティのエグゼクティブスポンサーは誰ですか？',
    ],
  },
  {
    topicId: 'tooling_access',
    topicName: 'ツール・アクセス・環境',
    targetQuestions: 9,
    answeredQuestions: 6,
    coveragePercent: 67,
    confidence: 72,
    nextQuestions: [
      '本番アクセスを申請する黄金ルートは何ですか？',
      'VaultとAWS Parameter Storeの使い分けルールはどうなっていますか？',
      'アクセス権限の棚卸しはどの周期で再認証しますか？',
    ],
  },
  {
    topicId: 'delivery_practices',
    topicName: '開発フローとデリバリ基準',
    targetQuestions: 15,
    answeredQuestions: 9,
    coveragePercent: 60,
    confidence: 68,
    nextQuestions: [
      'ADRはどのテンプレートと承認フローで記録しますか？',
      '各マイルストーンの出口基準は誰が管理していますか？',
      'レトロで出た学びはどのリポジトリで共有されますか？',
    ],
  },
  {
    topicId: 'security_compliance',
    topicName: 'セキュリティ・コンプライアンス・プライバシー',
    targetQuestions: 13,
    answeredQuestions: 11,
    coveragePercent: 85,
    confidence: 90,
    nextQuestions: [
      '今年のSOC 2スコープに含まれるシステム一覧はどこで参照しますか？',
      'プライバシー影響評価(PIA)の依頼と保管場所は？',
    ],
  },
  {
    topicId: 'people_ops',
    topicName: 'ピープルオペレーションと制度',
    targetQuestions: 12,
    answeredQuestions: 10,
    coveragePercent: 83,
    confidence: 86,
    nextQuestions: [
      '海外採用者のリロケーション支援フローはどうなっていますか？',
      'ウェルビーイング手当の内訳（定期/単発）は？',
    ],
  },
  {
    topicId: 'onboarding_timeline',
    topicName: 'オンボーディング計画と成功指標',
    targetQuestions: 10,
    answeredQuestions: 5,
    coveragePercent: 50,
    confidence: 58,
    nextQuestions: [
      '各職種向けの30/60/90プランはどこで確認しますか？',
      'バディの評価とフィードバックはどのフォームで提出しますか？',
      '6週目までに紐づけるべきOKRや指標は何ですか？',
      'オンボーディング改善のためのフィードバック経路は？',
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
