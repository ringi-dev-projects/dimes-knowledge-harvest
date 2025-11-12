export type MockDocument = {
  companyName: string;
  generatedAt: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    subsections?: Array<{
      id: string;
      title: string;
      content: string;
    }>;
  }>;
};

export const mockDocument: MockDocument = {
  companyName: 'ラティスストリーム・テクノロジーズ株式会社',
  generatedAt: new Date().toISOString(),
  sections: [
    {
      id: 'company-overview',
      title: '企業概要と戦略ストーリー',
      content: `<p>ラティスストリーム・テクノロジーズ株式会社は「社員の初日不安をゼロにする」ことを掲げ、散在するナレッジを信頼できるワークフローに変換するプラットフォームを提供しています。2019年創業以来、フィンテック・ヘルスケア・クライメートテックなど140社以上のスケールアップ企業を支援してきました。</p>
        <ul>
          <li><strong>本社/拠点:</strong> リモートファースト。デンバー・トロント・ベルリンにハブを設置。</li>
          <li><strong>従業員数:</strong> 正社員240名、契約パートナー60名。11タイムゾーンに分散。</li>
          <li><strong>ARR:</strong> 年間経常収益4,800万ドル、ネットリテンション118%。</li>
          <li><strong>主力プロダクト:</strong> ナレッジグラフ、アダプティブ・プレイブック、コンプライアンス・コパイロット。</li>
        </ul>`,
      subsections: [
        {
          id: 'strategic-pillars',
          title: 'FY25重点戦略',
          content: `<ol>
              <li><strong>ガイド付きオンボーディング:</strong> 役割別レールをAI最適化し、主要顧客の立ち上げを30%短縮。</li>
              <li><strong>ガバナンス・バイ・デザイン:</strong> SOC2/HITRUST準拠テンプレートで規制業界の導入障壁を低減。</li>
              <li><strong>インサイト・フライホイール:</strong> ダッシュボードからギャップと改善提案を自動提示。</li>
              <li><strong>グローバル対応力:</strong> 多言語プレイブックと地域別コンテンツでEMEA/APACを支援。</li>
            </ol>`,
        },
        {
          id: 'market-momentum',
          title: '市場モメンタムの指標',
          content: `<p>分散型オンボーディングに課題を抱える企業ほど導入率が高く、平均リードタイムは47日。ワークフローと分析を一体で示せた案件は勝率が急上昇します。</p>
            <ul>
              <li><strong>勝ち筋:</strong> オンボーディングROIの可視化、統合監査、低いチェンジマネジメント負荷。</li>
              <li><strong>リスク兆候:</strong> レガシーCMS依存、オートメーション忌避、エグゼクティブスポンサー不在。</li>
              <li><strong>主要導入企業:</strong> タクタイルバンク、ニュートリノヘルス、ヴァーダント航空。</li>
            </ul>`,
        },
      ],
    },
    {
      id: 'mission-values',
      title: 'ミッション・バリュー・リーダーシップ指針',
      content: `<p>ミッションは「誰もがDay1から自信を持って価値提供できる世界づくり」。バリューは評価・報酬・プロジェクト判断の基準でもあり、次の行動を重視します。</p>
        <ol>
          <li><strong>コンテキストを可搬に。</strong> 意思決定を行われた場所で記録し背景まで共有。</li>
          <li><strong>共創可能な仕組みを。</strong> 多職種が改善に参加できるワークフローを設計。</li>
          <li><strong>ノイズよりシグナルを。</strong> 文書・ダッシュボード・会議は質と洞察を最優先。</li>
        </ol>`,
      subsections: [
        {
          id: 'values-in-practice',
          title: 'バリュー体現例',
          content: `<ul>
              <li><strong>コンテキスト共有:</strong> 重要プロジェクトはNotionブリーフ + Slack #exec-dailyで常時追跡。</li>
              <li><strong>共創:</strong> 四半期ごとに「ガーディアン」を任命し横断テーマをリード。</li>
              <li><strong>シグナル志向:</strong> PRDに「遅延と粗さの影響分析」を必須項目として追加。</li>
            </ul>`,
        },
        {
          id: 'leadership-expectations',
          title: 'リーダーシップ期待値',
          content: `<p>マネージャーは週次1on1と月次グロースレビューを実施し、Latticeでコミットメントを共有。48時間以内の障害物エスカレーション、エンゲージメントスコア、予実精度が評価指標です。</p>`,
        },
      ],
    },
    {
      id: 'product-platform',
      title: 'プロダクト/プラットフォームの全体像',
      content: `<p>プラットフォームは<strong>Capture</strong>・<strong>Reason</strong>・<strong>Guide</strong>の3層で構成され、顧客単位で保持期間・RBAC・コンプライアンス設定を柔軟に調整できます。</p>`,
      subsections: [
        {
          id: 'data-ingestion',
          title: 'データ収集とナレッジグラフ',
          content: `<ul>
              <li>Slack/Teams/Zoom/Salesforce/ServiceNow/Google Drive/GitHubなど25種と双方向連携。</li>
              <li>出来事を「ナレッジアトム」に正規化し、出所・オーナー・鮮度メタデータを付与。</li>
              <li>通常は1時間ごと、主要案件は5分ごとにグラフを更新。</li>
            </ul>
            <p><strong>注意:</strong> 規制業界では文字起こし禁止やリージョン固定があるため、早期にセキュリティへ相談。</p>`,
        },
        {
          id: 'guidance-layer',
          title: 'ガイダンス層と提供面',
          content: `<p>Guidance SDKはJira / Linear / Workday / 社内ポータルにコンテキストTipsを表示。PMがYAMLでトリガーを定義し、Enablementがブロックエディタで体験を編集します。</p>`,
        },
      ],
    },
    {
      id: 'customer-experience',
      title: '顧客・ペルソナ・価値訴求',
      content: `<p>ターゲットはオンボーディングが複雑なミッドマーケット〜エンタープライズ。Chief People Officer、Enablement責任者、Platform Engineering Leadなどが主要ペルソナです。</p>`,
    },
    {
      id: 'org-structure',
      title: '組織トポロジーと主要連絡先',
      content: `<p>ミッション型スクワッド（PdM/Design/Eng/Data）が顧客ジャーニー単位で編成され、各チームはNotionでチャーターとOKRを公開しています。</p>`,
    },
    {
      id: 'tooling-access',
      title: 'ツール・環境・アクセス管理',
      content: `<p>Day0アクセスはOktaで自動付与。標準バンドル外の権限はSlackのAccessBot経由でマネージャー＋データスチュワード承認が必要です。</p>`,
    },
    {
      id: 'delivery-lifecycle',
      title: 'デリバリライフサイクルと品質ゲート',
      content: `<p>2週間サイクルで「Discover → Plan → Build → Measure」を回し、各スプリントで成果デモを実施します。</p>`,
    },
    {
      id: 'security-compliance',
      title: 'セキュリティ・コンプライアンス・プライバシー',
      content: `<p>SOC 2 Type IIを維持しつつHITRUST認証を取得中。年次トレーニングと四半期ごとのフィッシング演習が義務です。</p>`,
    },
    {
      id: 'people-ops',
      title: 'ピープルオペレーションと福利厚生',
      content: `<p>People Opsは90日間オンボーディングに伴走し、Day1から福利厚生が有効です。</p>`,
    },
    {
      id: 'onboarding-timeline',
      title: 'オンボーディングタイムラインと成功指標',
      content: `<p>90日アークで週次チェックポイントとバディ制度を備え、成果をダッシュボードで追跡します。</p>`,
    },
    {
      id: 'communication-rituals',
      title: 'コミュニケーションと社内儀式',
      content: `<p>非同期を基本としつつ、高密度な儀式で整合性を保ちます。#announcementsで経営判断を共有し、隔週Demo Dayで顧客価値を紹介します。</p>`,
    },
    {
      id: 'resources-glossary',
      title: '付録: リソースと用語集',
      content: `<p>Day1にブックマークすべきリソース: オンボーディングダッシュボード、Runbookライブラリ、サポートキュー、インシデントハブなど。</p>`,
    },
  ],
};
