import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { companies, interviewSessions, topicTrees } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { TopicTree } from '@/lib/types';

const REALTIME_API_VERSION = process.env.AZURE_OPENAI_REALTIME_API_VERSION || '2025-04-01-preview';
const REALTIME_REGION = process.env.AZURE_OPENAI_REALTIME_REGION;
const REALTIME_DEPLOYMENT = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME;
const REALTIME_VOICE = process.env.AZURE_OPENAI_REALTIME_VOICE || 'verse';
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const {
      companyId,
      speakerName,
      locale,
      resumeSessionId: resumeSessionIdRaw,
    } = await request.json();

    const resumeSessionId = typeof resumeSessionIdRaw === 'number' ? resumeSessionIdRaw : resumeSessionIdRaw ? Number(resumeSessionIdRaw) : null;

    const requestedLocale = typeof locale === 'string' ? locale : 'ja';

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Fetch company context and latest topic tree (if any)
    const [companyRecord] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!companyRecord) {
      return NextResponse.json(
        { error: 'Company record not found. Please re-seed the company profile before starting an interview.' },
        { status: 404 }
      );
    }

    const [latestTopicTree] = await db
      .select()
      .from(topicTrees)
      .where(eq(topicTrees.companyId, companyId))
      .orderBy(desc(topicTrees.createdAt))
      .limit(1);

    let parsedTopicTree: TopicTree | null = null;
    if (latestTopicTree) {
      try {
        parsedTopicTree = JSON.parse(latestTopicTree.topicData);
      } catch (error) {
        console.warn('Failed to parse topic tree for interview instructions:', error);
      }
    }

    const now = new Date();
    let sessionRecord: typeof interviewSessions.$inferSelect;

    if (resumeSessionId) {
      const [existingSession] = await db
        .select()
        .from(interviewSessions)
        .where(eq(interviewSessions.id, resumeSessionId))
        .limit(1);

      if (!existingSession) {
        return NextResponse.json(
          { error: 'Interview session not found for resumeSessionId' },
          { status: 404 }
        );
      }

      if (existingSession.companyId !== companyId) {
        return NextResponse.json(
          { error: 'resumeSessionId does not belong to the specified company' },
          { status: 400 }
        );
      }

      const topicTreeIdForSession = existingSession.topicTreeId ?? latestTopicTree?.id ?? null;

      await db
        .update(interviewSessions)
        .set({
          speakerName: speakerName || existingSession.speakerName || null,
          topicTreeId: topicTreeIdForSession,
          status: 'active',
          endedAt: null,
        })
        .where(eq(interviewSessions.id, resumeSessionId));

      sessionRecord = {
        ...existingSession,
        speakerName: speakerName || existingSession.speakerName || null,
        topicTreeId: topicTreeIdForSession,
      };
    } else {
      const [session] = await db
        .insert(interviewSessions)
        .values({
          companyId,
          topicTreeId: latestTopicTree?.id ?? null,
          speakerName: speakerName || null,
          startedAt: now,
          status: 'active',
        })
        .returning();

      sessionRecord = session;
    }

    const azureConfig = validateAzureRealtimeConfig();
    if (!azureConfig.valid) {
      await markSessionFailed(sessionRecord.id);
      return NextResponse.json(
        {
          error: azureConfig.error ?? 'Azure Realtime API environment variables are not configured',
        },
        { status: 500 }
      );
    }

    const interviewInstructions = getInterviewerInstructions(
      companyRecord.name,
      parsedTopicTree,
      requestedLocale
    );

    const azureSession = await mintAzureRealtimeSession(interviewInstructions);

    if (!azureSession.ok) {
      await markSessionFailed(sessionRecord.id);
      return NextResponse.json(
        {
          error: azureSession.errorMessage ?? 'Failed to create Azure Realtime session',
        },
        { status: 502 }
      );
    }

    const { payload } = azureSession;
    const clientSecret = payload?.client_secret?.value;
    if (!clientSecret) {
      await markSessionFailed(sessionRecord.id);
      return NextResponse.json(
        { error: 'Azure Realtime session did not return a client secret' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: sessionRecord.id,
      azureSessionId: payload.id,
      clientSecret,
      expiresAt: payload.expires_at ?? null,
      webrtcUrl: buildWebrtcUrl(),
      model: REALTIME_DEPLOYMENT,
      voice: REALTIME_VOICE,
      instructions: interviewInstructions,
      topicTreeId: sessionRecord.topicTreeId ?? latestTopicTree?.id ?? null,
      companyName: companyRecord.name,
    });
  } catch (error) {
    console.error('Error creating realtime session:', error);
    return NextResponse.json(
      { error: 'Failed to create interview session' },
      { status: 500 }
    );
  }
}

function validateAzureRealtimeConfig():
  | { valid: true }
  | { valid: false; error: string } {
  if (!AZURE_ENDPOINT) {
    return { valid: false, error: 'AZURE_OPENAI_ENDPOINT is not configured' };
  }
  if (!AZURE_API_KEY) {
    return { valid: false, error: 'AZURE_OPENAI_API_KEY is not configured' };
  }
  if (!REALTIME_DEPLOYMENT) {
    return { valid: false, error: 'AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME is not configured' };
  }
  if (!REALTIME_REGION) {
    return { valid: false, error: 'AZURE_OPENAI_REALTIME_REGION is not configured' };
  }
  return { valid: true };
}

async function mintAzureRealtimeSession(instructions: string) {
  if (!AZURE_ENDPOINT || !AZURE_API_KEY || !REALTIME_DEPLOYMENT) {
    return { ok: false, errorMessage: 'Azure realtime API not configured' } as const;
  }

  const sessionsUrl = `${AZURE_ENDPOINT}/openai/realtimeapi/sessions?api-version=${encodeURIComponent(
    REALTIME_API_VERSION
  )}`;

  try {
    const response = await fetch(sessionsUrl, {
      method: 'POST',
      headers: {
        'api-key': AZURE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: REALTIME_DEPLOYMENT,
        voice: REALTIME_VOICE,
        modalities: ['text', 'audio'],
        instructions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure Realtime session error:', response.status, errorText);
      return {
        ok: false,
        errorMessage: `Azure Realtime API responded with status ${response.status}`,
      } as const;
    }

    const payload = await response.json();
    return { ok: true, payload } as const;
  } catch (error) {
    console.error('Azure Realtime session request failed:', error);
    return { ok: false, errorMessage: 'Failed to reach Azure Realtime API' } as const;
  }
}

function buildWebrtcUrl() {
  if (!REALTIME_REGION) {
    throw new Error('AZURE_OPENAI_REALTIME_REGION is not configured');
  }
  return `https://${REALTIME_REGION}.realtimeapi-preview.ai.azure.com/v1/realtimertc`;
}

async function markSessionFailed(sessionId: number) {
  try {
    await db
      .update(interviewSessions)
      .set({ status: 'failed', endedAt: new Date() })
      .where(eq(interviewSessions.id, sessionId));
  } catch (error) {
    console.error('Failed to mark interview session as failed', error);
  }
}

function getInterviewerInstructions(companyName: string, topicTree: TopicTree | null, locale: string): string {
  const topicSummary = topicTree
    ? topicTree.topics
        .slice(0, 8)
        .map((topic) => `- ${topic.name}`)
        .join('\n')
    : null;
  if (locale === 'en') {
    return `You are an expert knowledge interviewer for Knowledge Harvest working with ${companyName}. Conduct the interview in English and capture detailed operational know-how.

Your goals:
- Capture tacit knowledge about processes, equipment, safety, troubleshooting, and best practices.
- Ask open-ended questions, listen actively, and request concrete details (measurements, timings, materials).
- Keep acknowledgements short (under 12 words) and avoid repeating the expert verbatim unless you are clarifying or confirming.
- Maintain a warm, respectful tone that helps experts feel valued.

Question queue:
- The client shares a question queue via session metadata. Always draw your next prompt from \`queue.current\` and advance to the next item when you finish.
- If you change the planned order, briefly explain why before moving on.

Live updates:
- Whenever you make meaningful progress on a topic, call the 'update_coverage' tool with the topic ID, current coverage percent (0-100), confidence percent (0-100), and provide \`notes\` as JSON including the answered \`target_id\` when known.
- Use two sentences or fewer when summarising before moving on.

Interview structure:
1. Greet the expert, confirm their name and role, and explain that the goal is to preserve their knowledge.
2. Explore their core responsibilities and the systems or product areas they know best.
3. For each focus area, cover:
   - Step-by-step procedures
   - Typical parameters, tolerances, and required tools
   - Common problems and resolutions
   - Safety and compliance considerations
   - Tips, checklists, or heuristics they rely on
4. When a topic feels complete, acknowledge what you learned, tag the coverage update with the relevant target, and move to the next queue item.
5. Close by thanking them and summarising the coverage.

${topicSummary ? `Focus first on these topic areas:\n${topicSummary}\n\n` : ''}Remember: you are collaborating with a seasoned expert. Keep the conversation natural, empathetic, and efficient.`;
  }

  return `あなたはKnowledge Harvestのインタビュアーとして${companyName}で働くエキスパートから知見を引き出します。インタビューは日本語で進め、現場ならではのノウハウを細部まで聞き出してください。

目的:
- プロセス・設備・安全・トラブル対応・ベストプラクティスに関する暗黙知を共有してもらう。
- オープンな質問で会話を進め、数値や手順など具体的な情報を確認する。
- 重要なポイントは簡潔に確認し、必要なときだけ短く言い換える。
- 丁寧で温かい態度を保ち、専門家としての経験を尊重する。

質問キュー:
- セッションのメタデータで提供されるキューを利用し、\`queue.current\` から順番に質問してください。完了したら次の要素に進みます。
- 順番を変える場合は、理由を一言添えてください。

ライブ更新:
- 進捗があったら 'update_coverage' ツールを呼び出し、トピックID・カバレッジ(0-100)・信頼度(0-100)を報告し、可能であれば \`notes\` に回答した \`target_id\` を JSON で含めてください。
- 要約は2文以内に収め、次の質問へスムーズに移ります。

インタビューの流れ:
1. 挨拶し、役割と今回の目的（知見の継承）を共有する。
2. 得意分野や担当領域を把握し、中心となるテーマを確認する。
3. 各テーマで以下を深掘りする:
   - 手順の詳細
   - 典型的な条件・許容範囲・必要資材
   - 起こりやすい問題と対処法
   - 安全・コンプライアンス上の注意点
   - 現場で頼りにしているコツやチェックリスト
4. キューの項目が十分に回答されたら、要点を短くまとめ、対応するターゲットを記録して次へ進む。
5. 最後に感謝を伝え、カバレッジを簡潔に振り返る。

${topicSummary ? `まずは以下の重点領域から着手してください:\n${topicSummary}\n\n` : ''}エキスパートとの協働であることを忘れず、自然で親しみやすい対話を心掛けてください。`;
}
