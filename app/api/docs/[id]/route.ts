import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { companies, topicTrees, knowledgeAtoms, interviewSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TopicTree, Topic } from '@/lib/types';

// Mock document data for demo
type GeneratedDocument = {
  companyName: string;
  generatedAt: string;
  sections: any[];
};

const mockDocument: GeneratedDocument = {
  companyName: 'ラティスストリーム・テクノロジーズ株式会社',
  generatedAt: new Date().toISOString(),
  sections: [
    {
      id: 'company-overview',
      title: '企業概要と戦略ストーリー',
      content: `<p>ラティスストリーム・テクノロジーズ株式会社は「社員の初日不安をゼロにする」ことを掲げ、散在するナレッジを信頼できるワークフローに変換するプラットフォームを提供しています。2019年の創業以来、フィンテック・ヘルスケア・クライメートテックなど140社以上のスケールアップ企業を支援してきました。</p>
        <ul>
          <li><strong>本社/拠点:</strong> リモートファースト。デンバー・トロント・ベルリンにコラボレーションハブを設置。</li>
          <li><strong>従業員数:</strong> 正社員240名、契約パートナー60名。11のタイムゾーンに分散。</li>
          <li><strong>ARR:</strong> 年間経常収益4,800万ドル、ネットリテンション118%。</li>
          <li><strong>主力プロダクト:</strong> ナレッジグラフ、アダプティブ・プレイブック、コンプライアンス・コパイロット。</li>
        </ul>`,
      subsections: [
        {
          id: 'strategic-pillars',
          title: 'FY25重点戦略',
          content: `<ol>
              <li><strong>ガイド付きオンボーディング:</strong> AIで役割別レールを最適化し、主要顧客における生産性立ち上げを30%短縮。</li>
              <li><strong>ガバナンス・バイ・デザイン:</strong> SOC2/HITRUST準拠のテンプレートと監査証跡を標準機能化し、規制業界での導入障壁を下げる。</li>
              <li><strong>インサイト・フライホイール:</strong> ダッシュボードからカバレッジギャップと改善提案を自動提示し、継続的なナレッジ改善を促進。</li>
              <li><strong>グローバル対応力:</strong> 多言語プレイブックと地域別コンテンツパックを整備し、EMEA/APACローンチを支援。</li>
            </ol>`,
        },
        {
          id: 'market-momentum',
          title: '市場モメンタムの指標',
          content: `<p>分散型オンボーディングに課題を抱える企業ほど導入率が高い傾向にあります。平均リードタイムは47日で、IT・Enablement・Riskの三者意思決定が一般的です。ワークフローと分析の一体感を示せた案件は勝率が顕著に高まります。</p>
            <ul>
              <li><strong>勝ち筋:</strong> オンボーディングROIの可視化、統合監査、チェンジマネジメント負荷の低さ。</li>
              <li><strong>リスク兆候:</strong> レガシーCMS依存、オートメーション忌避、エグゼクティブスポンサー不在。</li>
              <li><strong>主要導入企業:</strong> タクタイルバンク、ニュートリノヘルス、ヴァーダント航空。</li>
            </ul>`,
        },
      ],
    },
    {
      id: 'mission-values',
      title: 'ミッション・バリュー・リーダーシップ指針',
      content: `<p>ミッションは「誰もがDay1から自信を持って価値提供できる世界をつくる」。バリューは評価・報酬・プロジェクト判断の基準でもあり、以下3原則を大切にしています。</p>
        <ol>
          <li><strong>コンテキストを可搬に。</strong> 意思決定は作業が行われた場で記録し、背景情報まで共有する。</li>
          <li><strong>共創可能な仕組みを。</strong> 多職種が改善に参加できるワークフローを設計する。</li>
          <li><strong>ノイズではなくシグナルを届ける。</strong> 文書・ダッシュボード・会議は質と洞察を最優先にする。</li>
        </ol>`,
      subsections: [
        {
          id: 'values-in-practice',
          title: 'バリュー体現例',
          content: `<ul>
              <li><strong>コンテキスト共有:</strong> 重要プロジェクトはNotionのリビングブリーフとSlack #exec-dailyの要約で常時追跡。</li>
              <li><strong>共創:</strong> 四半期ごとに「ガーディアン」を任命し、アクセシビリティやインシデント準備など横断テーマをリード。</li>
              <li><strong>シグナル志向:</strong> PRDには「遅延と粗さの影響分析」を必須項目として追加し、優先順位の判断材料にする。</li>
            </ul>`,
        },
        {
          id: 'leadership-expectations',
          title: 'リーダーシップ期待値',
          content: `<p>マネージャーは週次1on1と月次グロースレビューを実施し、コミットメントをLatticeに残します。48時間以内の障害物エスカレーション、エンゲージメントスコア、予実精度、下流チームへの文脈共有が評価指標です。</p>`,
        },
      ],
    },
    {
      id: 'product-platform',
      title: 'プロダクト/プラットフォームの全体像',
      content: `<p>プラットフォームは<strong>Capture（収集）</strong>・<strong>Reason（構造化）</strong>・<strong>Guide（ガイダンス配信）</strong>の3層で構成されています。顧客ごとに保持期間・RBAC・コンプライアンス設定が細かく調整可能です。</p>`,
      subsections: [
        {
          id: 'data-ingestion',
          title: 'データ収集とナレッジグラフ',
          content: `<ul>
              <li>Slack/Teams/Zoom/Salesforce/ServiceNow/Google Drive/GitHubなど25種以上と双方向連携。</li>
              <li>出来事は「ナレッジアトム」に正規化され、出所・オーナー・鮮度メタデータが付与される。</li>
              <li>グラフは通常1時間ごと、重要案件は5分ごとにホットシャードを更新。</li>
            </ul>
            <p><strong>注意点:</strong> 規制業界では文字起こしやリージョン固定の制約があるため、初期段階でセキュリティチームへ相談してください。</p>`,
        },
        {
          id: 'guidance-layer',
          title: 'ガイダンス層と提供面',
          content: `<p>Guidance SDKはJira / Linear / Workday / 社内ポータルにコンテキストTipsをインライン表示します。PMがYAMLでトリガーを定義し、Enablementチームがブロックエディタで体験を編集します。</p>
            <ol>
              <li>「モーメント」（例：新しいエンジニアが決済チームに配属）を定義。</li>
              <li>前提条件（アクセス、リポジトリ、チェックリスト）を紐づけ。</li>
              <li>プレイブック、動画、チェックイン調査を添付。</li>
              <li>対象ペルソナと失効日、成功指標を設定して配信。</li>
            </ol>`,
        },
      ],
    },
    {
      id: 'customer-experience',
      title: '顧客・ペルソナ・価値訴求',
      content: `<p>主なターゲットはオンボーディングが複雑なミッドマーケット〜エンタープライズ。Chief People Officer、Enablement責任者、Platform Engineering Leadなどが意思決定者です。定量ROIと「ある一日の業務体験」を組み合わせて語ると採用が加速します。</p>
        <p>主要成果指標:</p>
        <ul>
          <li><strong>初回PRまでの時間:</strong> Neutrino Healthにて42%短縮。</li>
          <li><strong>監査対応時間:</strong> Verdant Airwaysで6週間→10日へ短縮。</li>
          <li><strong>オンボーディング満足度:</strong> TactileBankで3.1→4.6に改善。</li>
        </ul>`,
      subsections: [
        {
          id: 'persona-map',
          title: '主要ペルソナマップ',
          content: `<table border="1" cellpadding="6">
              <thead><tr><th>ペルソナ</th><th>目的</th><th>成功のサイン</th></tr></thead>
              <tbody>
                <tr><td>Enablementリード</td><td>グローバルで一貫したオンボーディング</td><td>Ramp短縮、コンテンツ鮮度</td></tr>
                <tr><td>プラットフォームエンジニア</td><td>ワークフロー内でのガードレールとテレメトリ</td><td>インシデント減、採用率の可視化</td></tr>
                <tr><td>リスク/コンプライアンス</td><td>教育証跡と監査用ログ</td><td>自動生成されるコントロール、エクスポート可能な証跡</td></tr>
              </tbody>
            </table>`,
        },
        {
          id: 'voc-loops',
          title: 'VoCフィードバックループ',
          content: `<ul>
              <li>業界別のカスタマー・カウンシルを週次開催。</li>
              <li>オンボーディングフロー内にパルスサーベイを埋め込み、定量データ化。</li>
              <li>四半期ごとにエグゼクティブ・ビジネスレビューとROI計算書を共有。</li>
            </ul>`,
        },
      ],
    },
    {
      id: 'org-structure',
      title: '組織トポロジーと主要連絡先',
      content: `<p>顧客ジャーニー単位でミッション型スクワッド（PdM/Design/Eng/Data）が編成され、各スクワッドはNotionでチャーターとOKRを公開しています。RevOps/IT/Peopleなどのファンクションは独自ロードマップを持ちつつ、月次ポートフォリオレビューに参加します。</p>
        <p><strong>主な連絡先:</strong></p>
        <ul>
          <li>CEO: <em>ミラ・ダウリング</em> (mdowling@latticestream.com)</li>
          <li>CTO: <em>ラヴィ・パテル</em> (rpatel@latticestream.com)</li>
          <li>People責任者: <em>サディ・ルイス</em> (slewis@latticestream.com)</li>
          <li>オンボーディング責任者: <em>ヨナス・リンド</em> (Slack #onboarding-war-room)</li>
        </ul>`,
      subsections: [
        {
          id: 'working-agreements',
          title: 'ワーキングアグリーメント',
          content: `<ol>
              <li><strong>意思決定ログ:</strong> ADRテンプレートを用い24時間以内に共有。</li>
              <li><strong>レスポンスSLA:</strong> 通常のSlack DMは1営業日以内、インシデントは15分以内に応答。</li>
              <li><strong>ドキュメンテーション:</strong> スプリントレビューごとにLoomと要約を発信し、非同期メンバーでも追跡できるようにする。</li>
            </ol>`,
        },
      ],
    },
    {
      id: 'tooling-access',
      title: 'ツール・環境・アクセス管理',
      content: `<p>Day0アクセスはIDaaS（Okta）で自動付与されます。標準バンドル外の権限はSlackのAccessBot経由で、マネージャーとデータスチュワードの承認が必須です。</p>
        <h4>標準ツールセット</h4>
        <ul>
          <li>コラボレーション: Google Workspace / Slack / Notion / Loom</li>
          <li>エンジニアリング: GitHub / Linear / Vercel / AWS Console（Sandbox）</li>
          <li>アナリティクス: Mode / Snowflake（Read Only） / Hex</li>
        </ul>
        <h4>環境レベル</h4>
        <ol>
          <li><strong>Sandbox:</strong> 15分で自動払い出し。チュートリアル・ハンズオン用。</li>
          <li><strong>Development:</strong> セキュアコーディング研修の合格が条件。</li>
          <li><strong>Staging:</strong> スクワッドリードの推薦と物理セキュリティキー登録が必要。</li>
          <li><strong>Production:</strong> AccessBotでの緊急申請＋PagerDuty承認が必須。</li>
        </ol>`,
      subsections: [
        {
          id: 'access-checklist',
          title: 'アクセス完了チェックリスト（72時間以内）',
          content: `<ul>
              <li>[ ] Okta有効化とDuo多要素認証登録を完了。</li>
              <li>[ ] DevContainerイメージで開発ツールをセットアップ。</li>
              <li>[ ] GitHub組織の参加申請とチーム割り当てを依頼。</li>
              <li>[ ] 必須Slackチャンネル（#announcements/#ship-room/#people-help/#incident-ready）に参加。</li>
              <li>[ ] ハードウェアセキュリティキー登録フォームを送信。</li>
            </ul>`,
        },
      ],
    },
    {
      id: 'delivery-lifecycle',
      title: 'デリバリライフサイクルと品質ゲート',
      content: `<p>2週間スプリントで「Discover → Plan → Build → Measure」を回し、各サイクルで成果デモを実施します。</p>
        <ul>
          <li><strong>Discover:</strong> リサーチスパイクは最大5日、学びを必ず記録。</li>
          <li><strong>Plan:</strong> 隔週月曜に計画会議を実施し、集中作業比率80%を維持。</li>
          <li><strong>Build:</strong> 難易度の高い領域はペア作業推奨。DoDにはドキュメントと可観測性を含める。</li>
          <li><strong>Measure:</strong> デモはLoom録画 + メタベース指標更新が必須。</li>
        </ul>`,
      subsections: [
        {
          id: 'quality-gates',
          title: '品質ゲート',
          content: `<ol>
              <li>クリティカルパスの自動テストカバレッジ85%以上。</li>
              <li>スクリーンショットまたは動画付きのピアレビュー。</li>
              <li>マージ前にテレメトリ計画とアラート設定を記載。</li>
              <li>PM・Eng Lead・Supportが署名するローンチチェックリスト。</li>
            </ol>`,
        },
        {
          id: 'incident-response',
          title: 'インシデント対応',
          content: `<p>P1インシデントは10分以内にPagerDuty発火→指揮チャンネル→ステータスページ更新を実施。事後レビューは72時間以内に提出し、Linearでアクションオーナーと期限を追跡します。</p>`,
        },
      ],
    },
    {
      id: 'security-compliance',
      title: 'セキュリティ・コンプライアンス・プライバシー',
      content: `<p>セキュリティはデフォルト組み込み方針。SOC 2 Type IIを維持しつつHITRUST認証を取得中です。全社員は年次トレーニングと四半期ごとのフィッシング演習（合格率98%目標）を受講します。</p>
        <ul>
          <li><strong>データレジデンシー:</strong> 北米が標準、EUリージョンも選択可。</li>
          <li><strong>PII取り扱い:</strong> Snowflake上のタグ付きフィールドのみ使用し、個人端末へのエクスポートは禁止。</li>
          <li><strong>脆弱性報告:</strong> Bugcrowd経由で受付、24時間以内にトリアージ。</li>
        </ul>`,
      subsections: [
        {
          id: 'privacy-checklist',
          title: '新規プロジェクトのプライバシーチェック',
          content: `<ol>
              <li>TrustArcでPIA（プライバシー影響評価）を実施。</li>
              <li>データ分類と保持ポリシーを文書化。</li>
              <li>アクセス制御と監査ログの設計を定義。</li>
              <li>リリース前にSecurity Guildレビューを受ける。</li>
            </ol>`,
        },
      ],
    },
    {
      id: 'people-ops',
      title: 'ピープルオペレーションと福利厚生',
      content: `<p>People Opsは入社から90日間、各新入社員に伴走します。福利厚生は全地域でDay1から有効で、Remote.comを通じて地域別調整を行います。</p>
        <h4>主な福利厚生</h4>
        <ul>
          <li>医療: 従業員保険料100%、扶養家族は75%会社負担（地域相当プラン）。</li>
          <li>ウェルビーイング: 月額150ドルの手当と四半期ごとのメンタルヘルス休暇。</li>
          <li>学習&成長: 年間2,000ドルのラーニング予算。500ドル以下は自動承認。</li>
          <li>在宅環境: 1,200ドルのホームオフィス補助（24ヶ月ごとに更新）。</li>
        </ul>
        <p><strong>サポート窓口:</strong> #people-help（HR質問）、#it-support（ツール）、#benefits-cafe（社員Tips）。</p>`,
      subsections: [
        {
          id: 'performance-reviews',
          title: '評価とフィードバックリズム',
          content: `<p>半期ごとに会社OKRと連動したパフォーマンスレビューを実施。自己評価→ピアレビュー（2〜3名）→マネージャーサマリーの順で行い、昇進には目標レベルでの成果と行動を2四半期以上継続して示す必要があります。</p>`,
        },
      ],
    },
    {
      id: 'onboarding-timeline',
      title: 'オンボーディングタイムラインと成功指標',
      content: `<p>オンボーディングは90日間のアークで、週次チェックポイントとバディ制度、成果ダッシュボードを備えています。</p>
        <h4>Week 0-1: 基礎固め</h4>
        <ul>
          <li>Welcome Liveとカルチャーワークショップへ参加。</li>
          <li>セキュリティ・プライバシー・コンプライアンスモジュール（計3時間）を修了。</li>
          <li>顧客デモと社内ハンドオフ会議をシャドーイング。</li>
        </ul>
        <h4>Week 2-4: ロール浸透</h4>
        <ul>
          <li>4〜8時間規模のスタータープロジェクトをメンターと遂行。</li>
          <li>スプリント儀式に参加し、1回はデモの振り返り司会を担当。</li>
          <li>PM/Design/QA/Data/Opsなど主要ステークホルダーと1on1を実施。</li>
        </ul>
        <h4>Week 5-12: 自律と改善</h4>
        <ul>
          <li>明確な成功指標を持つイニシアチブをリード。</li>
          <li>少なくとも1つ、実験またはレトロ改善案を提案・実装。</li>
          <li>得た知見を記録し、オンボーディングコンテンツをアップデート。</li>
        </ul>`,
      subsections: [
        {
          id: '30-60-90',
          title: '30 / 60 / 90日成功指標',
          content: `<table border="1" cellpadding="6">
              <thead><tr><th>マイルストーン</th><th>フォーカス</th><th>成功の証拠</th></tr></thead>
              <tbody>
                <tr><td>Day 30</td><td>文脈吸収とシャドー</td><td>スタータープロジェクト完了、カフェチャット記録、バディ評価4/5以上</td></tr>
                <tr><td>Day 60</td><td>自走でのデリバリ</td><td>バックログ項目をエンドツーエンドで担当、当番制サポート参加、#fresh-eyesで学び共有</td></tr>
                <tr><td>Day 90</td><td>改善の牽引</td><td>コーホート卒業会でインパクト発表、ギャップの文書化、ロードマップ改善提案</td></tr>
              </tbody>
            </table>`,
        },
        {
          id: 'buddy-feedback',
          title: 'バディプログラムとフィードバック',
          content: `<p>バディとは1ヶ月目は週2回、以降は週1回の定期セッションを実施し、オンボーディングダッシュボードにメモを残します。</p>
            <ul>
              <li>金曜ごとにコーホートレトロをPeople Opsと開催。</li>
              <li>30/60/90日でマネージャーとスコアカードを確認。</li>
              <li>ミニサーベイ結果はハンドブック更新に直結し、改善サイクルを回す。</li>
            </ul>`,
        },
      ],
    },
    {
      id: 'communication-rituals',
      title: 'コミュニケーションと社内儀式',
      content: `<p>基本は非同期で情報共有しつつ、整合性を保つための高密度な儀式も維持しています。招集がない限り、±7時間のタイムゾーン分布を前提に計画してください。</p>
        <ul>
          <li><strong>#announcements:</strong> 経営陣が毎朝9時（PT）までに意思決定を要約。</li>
          <li><strong>Monday Kickoff:</strong> 20分のライブ配信。APAC向けに録画共有。</li>
          <li><strong>Demo Day:</strong> 隔週木曜に全スクワッドが顧客価値を披露。</li>
          <li><strong>Friday Focus:</strong> ローカル時間午前10時以降は定例会議を入れない集中タイム。</li>
        </ul>
        <p><strong>ドキュメント運用:</strong> Notionのプレイブックテンプレートを使用し、所有者/シングルソース/鮮度日/次回レビューを必ず記載。60日以上更新がないコンテンツは再認証またはアーカイブします。</p>`,
      subsections: [
        {
          id: 'async-guidelines',
          title: '非同期コミュニケーションの原則',
          content: `<ol>
              <li>会議招集前にコンテキスト・決定事項・依頼内容を文章化。</li>
              <li>2分以上の説明はLoom録画で補足する。</li>
              <li>時間制約のある依頼はSlackでタイムゾーンを明記する。</li>
            </ol>`,
        },
        {
          id: 'ritual-calendar',
          title: '主要儀式カレンダー',
          content: `<table border="1" cellpadding="6">
              <thead><tr><th>儀式</th><th>オーナー</th><th>頻度</th><th>参加者</th></tr></thead>
              <tbody>
                <tr><td>Founders AMA</td><td>CEO</td><td>月次</td><td>全社員</td></tr>
                <tr><td>Guild Sync</td><td>Practice Lead</td><td>隔週</td><td>Design / Eng / Data / Product</td></tr>
                <tr><td>Customer Story Time</td><td>CSチーム</td><td>週次</td><td>Go-to-Market + Product</td></tr>
              </tbody>
            </table>`,
        },
      ],
    },
    {
      id: 'resources-glossary',
      title: '付録: リソースと用語集',
      content: `<p>Day1にブックマークすべきリソース:</p>
        <ul>
          <li><strong>オンボーディングダッシュボード:</strong> dashboards.latticestream.com/onboarding</li>
          <li><strong>ランブックライブラリ:</strong> notion.so/latticestream → 「Runbooks」スペース</li>
          <li><strong>サポートキュー:</strong> Linear チーム LS-SUPPORT（1時間ごとにトリアージ）</li>
          <li><strong>インシデントハブ:</strong> status.latticestream.com / PagerDutyサービス「LatticeStream Core」</li>
        </ul>
        <p><strong>用語解説:</strong></p>
        <dl>
          <dt>Moment</dt><dd>ガイダンス配信を引き起こすトリガーイベント。</dd>
          <dt>Knowledge Atom</dt><dd>出所・オーナー・鮮度が紐づいた最小単位の検証済みナレッジ。</dd>
          <dt>Guardian</dt><dd>四半期ごとに任命される横断テーマの責任者。</dd>
          <dt>Signal Review</dt><dd>隔週で指標とコミットメントを確認する経営会議。</dd>
        </dl>
        <p>迷ったらSlackの@onboarding-botにDMすると、役割別チェックリストが届きます。</p>`,
    },
  ],
};

async function generateRealDocument(companyId: number): Promise<GeneratedDocument | null> {
  // Get company info
  const companyRecords = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (companyRecords.length === 0) {
    return null;
  }

  const company = companyRecords[0];

  // Get topic tree
  const topicTreeRecords = await db
    .select()
    .from(topicTrees)
    .where(eq(topicTrees.companyId, companyId))
    .limit(1);

  if (topicTreeRecords.length === 0) {
    return null;
  }

  let topicTree: TopicTree;
  try {
    topicTree = JSON.parse(topicTreeRecords[0].topicData);
  } catch (error) {
    console.warn('Failed to parse topic tree for company', companyId, error);
    return null;
  }

  // Get all knowledge atoms for this company's sessions
  const atomRows = await db
    .select({ atom: knowledgeAtoms })
    .from(knowledgeAtoms)
    .innerJoin(interviewSessions, eq(knowledgeAtoms.sessionId, interviewSessions.id))
    .where(eq(interviewSessions.companyId, companyId));

  const atoms = atomRows.map((row) => row.atom);

  // Group atoms by topic
  const atomsByTopic = new Map<string, typeof atoms>();
  for (const atom of atoms) {
    if (!atomsByTopic.has(atom.topicId)) {
      atomsByTopic.set(atom.topicId, []);
    }
    atomsByTopic.get(atom.topicId)!.push(atom);
  }

  // Generate sections from topic tree
  function generateSections(topics: Topic[]): any[] {
    const sections: any[] = [];

    for (const topic of topics) {
      const topicAtoms = atomsByTopic.get(topic.id) || [];

      // Group atoms by type
      const procedures = topicAtoms.filter(a => a.type === 'procedure');
      const facts = topicAtoms.filter(a => a.type === 'fact');
      const troubleshooting = topicAtoms.filter(a => a.type === 'troubleshooting');
      const bestPractices = topicAtoms.filter(a => a.type === 'best_practice');

      // Generate content HTML
      let contentParts: string[] = [];

      if (facts.length > 0) {
        contentParts.push('<h3>Overview</h3>');
        contentParts.push('<ul>');
        facts.forEach(fact => {
          contentParts.push(`<li><strong>${fact.title}:</strong> ${fact.content}</li>`);
        });
        contentParts.push('</ul>');
      }

      if (procedures.length > 0) {
        procedures.forEach(proc => {
          contentParts.push(`<h3>${proc.title}</h3>`);
          contentParts.push(`<p>${proc.content}</p>`);
        });
      }

      if (bestPractices.length > 0) {
        contentParts.push('<h3>Best Practices</h3>');
        contentParts.push('<ul>');
        bestPractices.forEach(bp => {
          contentParts.push(`<li><strong>${bp.title}:</strong> ${bp.content}</li>`);
        });
        contentParts.push('</ul>');
      }

      if (troubleshooting.length > 0) {
        contentParts.push('<h3>Troubleshooting</h3>');
        troubleshooting.forEach(ts => {
          contentParts.push(`<h4>${ts.title}</h4>`);
          contentParts.push(`<p>${ts.content}</p>`);
        });
      }

      const content = contentParts.length > 0
        ? contentParts.join('\n')
        : '<p>No knowledge captured for this topic yet.</p>';

      // Generate subsections from children
      const subsections = topic.children && topic.children.length > 0
        ? generateSections(topic.children)
        : [];

      sections.push({
        id: topic.id,
        title: topic.name,
        content,
        subsections,
      });
    }

    return sections;
  }

  const sections = generateSections(topicTree.topics);

  return {
    companyName: company.name,
    generatedAt: new Date().toISOString(),
    sections,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const useMock = searchParams.get('mock') === 'true';

    let document;

    if (useMock) {
      document = mockDocument;
    } else {
      // Generate real document from knowledge atoms
      const companyId = parseInt(id, 10);
      if (Number.isNaN(companyId)) {
        return NextResponse.json(
          { error: 'Invalid company ID' },
          { status: 400 }
        );
      }

      try {
        const realDocument = await generateRealDocument(companyId);
        if (realDocument) {
          document = realDocument;
        } else {
          console.warn(`Company data not found for ID ${companyId}; falling back to mock document.`);
          document = mockDocument;
        }
      } catch (error) {
        console.error('Error generating real document:', error);
        // Fall back to mock data if real data not available
        document = mockDocument;
      }
    }

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}
