export type Locale = 'ja' | 'en';

type NavigationKey = 'home' | 'seed' | 'interview' | 'dashboard';

type Dictionary = {
  common: {
    navigation: Record<NavigationKey, string> & { getStarted: string };
    languageName: Record<Locale, string>;
    brand: { name: string; tagline: string; credit: string };
    duration: {
      placeholder: string;
      formatFull: string;
      formatMinutes: string;
      formatSeconds: string;
    };
    time: {
      momentsAgo: string;
    };
    statuses: {
      completed: string;
      active: string;
      failed: string;
      default: string;
    };
  };
  home: {
    hero: {
      badge: string;
      title: string;
      subtitle: string;
      primaryCta: string;
      secondaryCta: string;
      stats: Array<{ label: string; value: string; description: string }>;
    };
    features: Array<{ title: string; description: string }>;
    howItWorks: {
      badge: string;
      title: string;
      description: string;
      steps: string[];
      snapshot: {
        title: string;
        description: string;
        topics: Array<{ name: string; value: string }>;
      };
      queue: {
        title: string;
        items: string[];
      };
    };
  };
  dashboard: {
    hero: {
      badge: string;
      title: string;
      description: string;
      toggleMockOn: string;
      toggleMockOff: string;
      docsEnabled: string;
      docsDisabled: string;
    };
    metrics: {
      coverage: { title: string; subtitle: string };
      confidence: { title: string; subtitle: string };
      topics: { title: string; summary: string; suffix: string };
      interviewSessions: { title: string; empty: string; nonEmpty: string };
    };
    coverageSection: {
      title: string;
      subtitle: string;
      loading: string;
      emptyTitle: string;
      emptySubtitle: string;
      seedCta: string;
      mockCta: string;
    };
    interviewsSection: {
      title: string;
      subtitle: string;
      startCta: string;
      loading: string;
      emptyTitle: string;
      emptySubtitle: string;
      primaryCta: string;
      secondaryCta: string;
      audioBadge: string;
      docLink: string;
    };
    cards: {
      defaultSpeaker: string;
      metrics: {
        duration: string;
        knowledge: string;
        messages: string;
      };
      coverage: {
        answeredTemplate: string;
        coverageLabel: string;
        confidenceLabel: string;
        nextQuestions: string;
      };
    };
    admin: {
      title: string;
      description: string;
      button: string;
      buttonBusy: string;
      confirm: string;
      success: string;
      error: string;
    };
  };
  seed: {
    title: string;
    subtitle: string;
    dashboardLink: string;
    assistantLabel: string;
    assistant: {
      placeholderActive: string;
      placeholderComplete: string;
      mappingIndicator: string;
      send: string;
      errorRequired: string;
      skipTag: string;
      completeHint: string;
      intros: {
        new: string;
        extend: string;
        extendFallback: string;
      };
      prompts: {
        companyName: string;
        companyUrl: string;
        focusNew: string;
        focusExtend: string;
        descriptionNew: string;
        descriptionExtend: string;
      };
      mappingCue: string;
      success: string;
      failure: string;
    };
    focusSuggestions: string[];
    panels: {
      currentTitle: string;
      extend: string;
      newCompany: string;
      promptsReady: string;
      reminder: string;
      firstTimeTitle: string;
      firstTimeDescription: string;
      examplesTitle: string;
      examples: string[];
      tipsTitle: string;
      tips: string[];
    };
    topicPreview: {
      weightLabel: string;
      followUps: string;
    };
    results: {
      badge: string;
      title: string;
      companyLabel: string;
      startInterview: string;
      viewDashboard: string;
    };
  };
  interview: {
    hero: {
      badge: string;
      title: string;
      description: string;
      descriptionWithCompany: string;
      companyReady: string;
      companyMissing: string;
      sessionLabel: string;
    };
    status: {
      connecting: string;
      active: string;
      ended: string;
      idle: string;
    };
    connection: {
      recording: string;
      connecting: string;
      ready: string;
      dropped: string;
    };
    buttons: {
      stop: string;
      stopPending: string;
      start: string;
      startPending: string;
    };
    errors: {
      missingCompany: string;
      session: string;
      startFailed: string;
      persistFailed: string;
      realtimeCredentials: string;
      realtimeOfferRejected: string;
      transcription: string;
    };
    transcript: {
      title: string;
      assistantLabel: string;
      userLabel: string;
      empty: string;
    };
    postSession: {
      title: string;
      description: string;
      dashboard: string;
      docs: string;
      restart: string;
      tip: string;
    };
    coverage: {
      title: string;
      subtitle: string;
      syncing: string;
      empty: string;
      suggestedTitle: string;
      suggestedEmpty: string;
      suggestedItemPrefix: string;
      suggestedItemSuffix: string;
      metricLabel: string;
    };
    queue: {
      currentTitle: string;
      empty: string;
      markAnswered: string;
      skip: string;
      requiredTag: string;
      optionalTag: string;
      feedbackPrompt: string;
      feedbackPositive: string;
      feedbackNegative: string;
      pendingCount: string;
      nextTitle: string;
      nextEmpty: string;
      completedTitle: string;
      completedEmpty: string;
    };
    speaker: {
      liveActivity: string;
      assistant: string;
      user: string;
      speaking: string;
    };
    timer: {
      elapsedLabel: string;
      remainingLabel: string;
      autoWrapCountdown: string;
      instructions: {
        timeboxed: string;
        unlimited: string;
        unlimitedWithReminder: string;
      };
      options: {
        heading: string;
        guidance: string;
        pendingResume: string;
        '15': { label: string; description: string };
        '30': { label: string; description: string };
        unlimited: { label: string; description: string };
      };
      unlimitedReminder: {
        label: string;
        none: string;
        every: string;
      };
      reminders: {
        fiveMinutes: string;
        twoMinutes: string;
        oneMinute: string;
        autowrap: string;
        unlimited: string;
      };
      autosaveIdle: string;
      autosaveSaving: string;
      autosaveError: string;
      autosaveRetry: string;
      autosaveFallbackError: string;
      resume: {
        title: string;
        description: string;
        fallbackTimestamp: string;
        continueCta: string;
        discardCta: string;
        timer: {
          timeboxed: string;
          unlimited: string;
        };
      };
      wrapModal: {
        title: string;
        description: string;
        extend: string;
        extendDisabled: string;
        stop: string;
      };
    };
    ai: {
      instructions: string;
    };
    defaults: {
      topics: Array<{ id: string; name: string }>;
    };
  };
};

const en: Dictionary = {
  common: {
    navigation: {
      home: 'Home',
      seed: 'Seed Topics',
      interview: 'Interview',
      dashboard: 'Dashboard',
      getStarted: 'Get Started',
    },
    languageName: {
      ja: '日本語',
      en: 'English',
    },
    brand: {
      name: 'Knowledge Harvest',
      tagline: 'Capture and scale expert know-how',
      credit: 'A project by Dimes株式会社',
    },
    duration: {
      placeholder: '—',
      formatFull: '{{minutes}}m {{seconds}}s',
      formatMinutes: '{{minutes}}m',
      formatSeconds: '{{seconds}}s',
    },
    time: {
      momentsAgo: 'Moments ago',
    },
    statuses: {
      completed: 'Completed',
      active: 'In progress',
      failed: 'Failed',
      default: '{{status}}',
    },
  },
  home: {
    hero: {
      badge: 'AI KNOWLEDGE PLATFORM',
      title: 'Capture and amplify the expertise your business runs on',
      subtitle:
        "Knowledge Harvest blends voice-first interviews with adaptive AI guidance so you can map, measure, and share hard-won know-how in days—not months.",
      primaryCta: 'Start with Topic Seed',
      secondaryCta: 'Preview Dashboard',
      stats: [
        {
          label: 'MINUTES TO SET UP',
          value: '10',
          description: 'Seed targeted question maps in under fifteen minutes.',
        },
        {
          label: 'LIVE INTERVIEWS',
          value: 'Realtime',
          description: 'AI co-pilot adapts prompts as experts speak.',
        },
        {
          label: 'KNOWLEDGE ASSETS',
          value: 'Auto Docs',
          description: 'Instant handbooks, transcripts, and action items.',
        },
      ],
    },
    features: [
      {
        title: 'Voice-First Capture',
        description:
          'Experts speak naturally on browser or phone while AI interviewers probe, clarify, and flag follow-ups in real time.',
      },
      {
        title: 'Coverage Tracking',
        description:
          'Visualize topic coverage, confidence, and unanswered questions so you know exactly where to focus next.',
      },
      {
        title: 'Auto-Assembled Deliverables',
        description:
          'Turn captured knowledge into living handbooks, onboarding guides, and SOPs that stay searchable and shareable.',
      },
    ],
    howItWorks: {
      badge: 'How it works',
      title: 'From raw conversations to confident knowledge coverage',
      description:
        'Knowledge Harvest keeps every step aligned—from mapping topics to interviewing experts and generating documentation—so your organization never loses critical know-how again.',
      steps: [
        'Seed your knowledge tree with company context and get a prioritized set of interview targets in minutes.',
        'Run guided voice interviews. The AI interviewer adapts, probes, and creates clean transcripts automatically.',
        'Track coverage in real time and export polished documentation ready for onboarding or operational playbooks.',
      ],
      snapshot: {
        title: 'Coverage snapshot',
        description: 'Surfacing the strongest and weakest knowledge areas at a glance.',
        topics: [
          { name: 'Safety protocols', value: '86%' },
          { name: 'Maintenance routines', value: '62%' },
          { name: 'Equipment settings', value: '44%' },
        ],
      },
      queue: {
        title: 'Next question queue',
        items: [
          'What conditions trigger a line restart?',
          'Which tools need weekly calibration?',
          'How do you triage urgent customer issues?',
        ],
      },
    },
  },
  dashboard: {
    hero: {
      badge: 'Coverage intelligence',
      title: 'Knowledge Coverage Dashboard',
      description:
        'Track capture progress by topic, understand confidence levels, and focus interviews where they matter most.',
      toggleMockOn: 'Show Real Data',
      toggleMockOff: 'Show Mock Data',
      docsEnabled: 'Generate Documentation',
      docsDisabled: 'Seed Topics to Enable Docs',
    },
    metrics: {
      coverage: {
        title: 'Overall Coverage',
        subtitle: 'of targeted knowledge captured',
      },
      confidence: {
        title: 'Confidence Score',
        subtitle: 'validated across interviews',
      },
      topics: {
        title: 'Topics Covered',
        summary: 'High-confidence topics that surpass the 50% coverage threshold.',
        suffix: 'of {{total}}',
      },
      interviewSessions: {
        title: 'Interview Sessions',
        empty: 'Sync this dashboard with live interviews to watch coverage fill in.',
        nonEmpty: 'Review captured sessions below to see what knowledge you unlocked.',
      },
    },
    coverageSection: {
      title: 'Topic Coverage Details',
      subtitle: 'Dive into each topic to uncover gaps, confidence trends, and next-step prompts.',
      loading: 'Fetching the latest coverage metrics…',
      emptyTitle: 'No coverage data yet',
      emptySubtitle: 'Seed topics and launch interviews to see progress here.',
      seedCta: 'Seed Topics',
      mockCta: 'Load Mock Data',
    },
    interviewsSection: {
      title: 'Interview History & Highlights',
      subtitle: 'Track recorded sessions, duration, and how much knowledge each interview produced.',
      startCta: 'Start New Interview',
      loading: 'Loading interview sessions…',
      emptyTitle: 'No interviews recorded yet',
      emptySubtitle: 'Launch your first session to start capturing expert know-how.',
      primaryCta: 'Launch Interview',
      secondaryCta: 'Seed Topics',
      audioBadge: 'Audio archived',
      docLink: 'View documentation',
    },
    admin: {
      title: 'Maintenance',
      description: 'Delete all companies, interviews, and stored audio for a clean slate.',
      button: 'Reset data',
      buttonBusy: 'Resetting…',
      confirm: 'This will permanently delete every record and audio file. Continue?',
      success: 'All data has been cleared.',
      error: 'Reset failed. Please try again.',
    },
    cards: {
      defaultSpeaker: 'Expert contributor',
      metrics: {
        duration: 'Duration',
        knowledge: 'Knowledge atoms',
        messages: 'Messages captured',
      },
      coverage: {
        answeredTemplate: '{{answered}} of {{total}} questions answered',
        coverageLabel: 'Coverage',
        confidenceLabel: 'Confidence',
        nextQuestions: 'Next Questions to Ask',
      },
    },
  },
  seed: {
    title: 'Seed topics',
    subtitle: 'Start with a focused map and refine as you capture more knowledge.',
    dashboardLink: 'View dashboard →',
    assistantLabel: 'Intake assistant',
    assistant: {
      placeholderActive: 'Type your answer and press enter…',
      placeholderComplete: 'All set! Use the actions above to seed another area.',
      mappingIndicator: 'Mapping topics…',
      send: 'Send',
      errorRequired: 'Please provide a quick answer so I can keep going.',
      skipTag: '[Skipped]',
      completeHint: 'Want to add another area or start fresh? Use the actions on the left to relaunch the intake.',
      intros: {
        new: "Let's gather a few essentials so I can draft a concise topic map you can interview against.",
        extend: "We already have a knowledge map for {{company}}. Let's capture a fresh slice so I can extend it without duplicating what we know.",
        extendFallback: 'this company',
      },
      prompts: {
        companyName: "First things first—what's the company called?",
        companyUrl: 'Do you have a public URL I can skim for extra context? (optional)',
        focusNew: 'Which product, business unit, or knowledge area should we focus on first?',
        focusExtend: 'Which product, business unit, or knowledge area should we extend next?',
        descriptionNew: 'Share a quick description so I can tailor the map to the way your company operates.',
        descriptionExtend: 'Share any fresh context or goals for this update so the map stays concise.',
      },
      mappingCue: 'Great. Give me a moment to map this out…',
      success: 'All set! Scroll down to review the refreshed map or jump straight into the interview.',
      failure: 'I hit a snag capturing the topics. Fix the issue above and we can try again.',
    },
    focusSuggestions: [
      'Onboarding new hires',
      'Manufacturing process',
      'Critical equipment maintenance',
      'Customer support playbook',
      'Safety & compliance routines',
    ],
    panels: {
      currentTitle: 'Current map',
      extend: 'Extend',
      newCompany: 'New company',
      promptsReady: 'Prompts ready to go',
      reminder: 'Extend one area at a time—you can always loop back to add another division.',
      firstTimeTitle: 'New company?',
      firstTimeDescription:
        'Share the basics—name, optional URL, and the first area you want to document. We’ll return a compact, interview-ready topic list.',
      examplesTitle: 'Example inputs',
      examples: [
        'Company name: “Acme Precision Parts”',
        'Focus area: “CNC machining QA checks”',
        'Description: 2–3 sentences on teams, processes, or pain points',
      ],
      tipsTitle: 'Tips',
      tips: [
        'Be specific (“Assembly line onboarding” beats “operations”).',
        'Re-run the intake anytime to add a new division or product line.',
      ],
    },
    topicPreview: {
      weightLabel: 'Weight',
      followUps: 'Follow-up prompts ready',
    },
    results: {
      badge: 'Generated map',
      title: 'Topic tree preview',
      companyLabel: 'Company',
      startInterview: 'Start interview',
      viewDashboard: 'View dashboard',
    },
  },
  interview: {
    hero: {
      badge: 'Interview studio',
      title: 'Knowledge interview',
      description:
        'Run a voice-first interview that adapts on the fly, captures transcripts, and feeds straight into coverage analytics.',
      descriptionWithCompany:
        '{{company}} - Run a voice-first interview that adapts on the fly, captures transcripts, and feeds straight into coverage analytics.',
      companyReady: 'Company ready (ID: {{id}})',
      companyMissing: 'Generate a topic tree to activate interviews',
      sessionLabel: 'Session #{{id}}',
    },
    status: {
      connecting: 'Connecting',
      active: 'Live',
      ended: 'Saved',
      idle: 'Idle',
    },
    connection: {
      recording: 'Recording',
      connecting: 'Connecting...',
      ready: 'Ready to start',
      dropped: 'The realtime connection dropped. Please try restarting the interview.',
    },
    buttons: {
      stop: 'Stop interview',
      stopPending: 'Stopping…',
      start: 'Start interview',
      startPending: 'Starting…',
    },
    errors: {
      missingCompany: 'Please generate a topic tree first from the Seed page',
      session: 'The realtime session reported an error. Please try again.',
      startFailed: 'Failed to start interview',
      persistFailed: 'Failed to save interview session',
      realtimeCredentials: 'Realtime session is missing connection credentials',
      realtimeOfferRejected: 'Azure Realtime service rejected the WebRTC offer. Check model deployment.',
      transcription: 'Speech recognition error: {{message}}',
    },
    transcript: {
      title: 'Live transcript',
      assistantLabel: 'AI interviewer',
      userLabel: 'You',
      empty: 'Click "Start interview" to begin capturing responses.',
    },
    postSession: {
      title: 'Interview saved',
      description:
        'We captured the transcript, audio, and updated coverage metrics. What would you like to do next?',
      dashboard: 'View Dashboard',
      docs: 'View Documentation',
      restart: 'Start Another Interview',
      tip: 'Tip: You can revisit any session later from the dashboard’s interview history.',
    },
    coverage: {
      title: 'Coverage progress',
      subtitle: 'Track how the conversation is filling your priority areas.',
      syncing: 'Syncing coverage from recent sessions…',
      empty: 'Coverage will populate as soon as the first topic is captured.',
      suggestedTitle: 'Suggested follow-ups',
      suggestedEmpty: 'Focus on capturing foundational knowledge for your highest priority topics.',
      suggestedItemPrefix: 'Explore more about',
      suggestedItemSuffix: '(currently {{coverage}}% coverage, {{confidence}}% confidence)',
      metricLabel: 'Confidence',
    },
    queue: {
      currentTitle: 'Current question',
      empty: 'Queue is empty. Add new targets from the Seed page.',
      markAnswered: 'Mark answered',
      skip: 'Skip for now',
      requiredTag: 'Required',
      optionalTag: 'Optional',
      feedbackPrompt: 'How helpful was this question?',
      feedbackPositive: 'Helpful',
      feedbackNegative: 'Needs work',
      pendingCount: '{{count}} remaining',
      nextTitle: 'Next up',
      nextEmpty: 'No more upcoming prompts.',
      completedTitle: 'Completed this session',
      completedEmpty: 'Nothing captured yet.',
    },
    speaker: {
      liveActivity: 'Live activity',
      assistant: 'AI interviewer',
      user: 'You',
      speaking: 'Speaking',
    },
    timer: {
      elapsedLabel: 'Elapsed time',
      remainingLabel: 'Time remaining',
      autoWrapCountdown: 'Auto wrap in {{seconds}}',
      instructions: {
        timeboxed:
          'This session is scheduled for {{minutes}} minutes. Keep the conversation efficient and start closing when roughly three minutes remain.',
        unlimited:
          'The session is uncapped; watch for fatigue and suggest pausing to summarise when the expert slows down.',
        unlimitedWithReminder:
          'The session is uncapped. Offer a quick break every {{minutes}} minutes so the expert can reset and confirm key points.',
      },
      options: {
        heading: 'Session length',
        guidance: 'Choose how long the AI should pace the interview before prompting a wrap-up.',
        pendingResume: 'Using the timer from your last autosave.',
        '15': {
          label: '15 minutes',
          description: 'Focused capture and calibration check-ins.',
        },
        '30': {
          label: '30 minutes',
          description: 'Deep-dive territory without burning out the expert.',
        },
        unlimited: {
          label: 'No limit',
          description: 'Manual wrap-up with optional reminder pings.',
        },
      },
      unlimitedReminder: {
        label: 'Break reminders',
        none: 'Disable reminders',
        every: 'Every {{minutes}} minutes',
      },
      reminders: {
        fiveMinutes: 'Five minutes left—plan your wrap-up.',
        twoMinutes: 'Two minutes left—gather any critical gaps.',
        oneMinute: 'One minute left—summarise and confirm next steps.',
        autowrap: 'Time is up! Extending once will add five minutes.',
        unlimited: 'No cap set—suggest pausing to recap before continuing.',
      },
      autosaveIdle: 'Autosave ready',
      autosaveSaving: 'Saving progress…',
      autosaveError: 'Autosave paused—retry?',
      autosaveRetry: 'Save now',
      autosaveFallbackError: 'Autosave failed. We will keep retrying.',
      resume: {
        title: 'Resume your previous session?',
        description: 'We auto-saved this interview at {{updated}}. Continue where you left off or discard the draft.',
        fallbackTimestamp: 'the last session',
        continueCta: 'Resume interview',
        discardCta: 'Discard autosave',
        timer: {
          timeboxed: 'Saved with a {{minutes}}-minute timer.',
          unlimited: 'Saved with no time limit.',
        },
      },
      wrapModal: {
        title: 'Time to wrap?',
        description: 'We reached the planned limit. Finish now or extend by five minutes. Auto wrap in {{countdown}}.',
        extend: 'Extend 5 minutes',
        extendDisabled: 'Extension already used',
        stop: 'Wrap up now',
      },
    },
    ai: {
      instructions:
        'You are a helpful interviewer focused on capturing operational knowledge with open-ended, respectful questions.',
    },
    defaults: {
      topics: [
        { id: 'products_services', name: 'Products & Services' },
        { id: 'processes', name: 'Processes' },
        { id: 'equipment', name: 'Equipment' },
        { id: 'safety', name: 'Safety' },
      ],
    },
  },
};

const ja: Dictionary = {
  common: {
    navigation: {
      home: 'ホーム',
      seed: 'シードトピック',
      interview: 'インタビュー',
      dashboard: 'ダッシュボード',
      getStarted: 'はじめる',
    },
    languageName: {
      ja: '日本語',
      en: 'English',
    },
    brand: {
      name: 'ナレッジ・ハーベスト',
      tagline: '現場の知見を収集して共有する',
      credit: 'Dimes株式会社によるプロジェクト',
    },
    duration: {
      placeholder: '—',
      formatFull: '{{minutes}}分{{seconds}}秒',
      formatMinutes: '{{minutes}}分',
      formatSeconds: '{{seconds}}秒',
    },
    time: {
      momentsAgo: 'たった今',
    },
    statuses: {
      completed: '完了',
      active: '進行中',
      failed: '失敗',
      default: '{{status}}',
    },
  },
  home: {
    hero: {
      badge: 'AIナレッジプラットフォーム',
      title: '事業を支える専門知識を記録して活用する',
      subtitle:
        'Knowledge Harvestは音声中心のインタビューと適応型AIガイダンスを組み合わせ、数日で重要なノウハウをマッピング・測定・共有できます。',
      primaryCta: 'トピックシードから始める',
      secondaryCta: 'ダッシュボードを見る',
      stats: [
        {
          label: 'セットアップ時間',
          value: '10',
          description: '15分以内に狙いを定めた質問マップを用意できます。',
        },
        {
          label: 'ライブインタビュー',
          value: 'リアルタイム',
          description: 'AIコパイロットが会話に合わせて質問を調整します。',
        },
        {
          label: 'ナレッジ資産',
          value: '自動ドキュメント',
          description: 'ハンドブックや議事録、アクションアイテムを即時で生成します。',
        },
      ],
    },
    features: [
      {
        title: '音声ファーストの収集',
        description:
          '専門家がブラウザや電話で自然に話すだけで、AIインタビュアーがその場で深掘りと確認を行います。',
      },
      {
        title: 'カバレッジトラッキング',
        description:
          'トピックの網羅度や信頼度、未回答の質問を可視化し、次に注力すべき領域を把握します。',
      },
      {
        title: '自動組み立てドキュメント',
        description:
          '収集したナレッジを検索できるハンドブックやオンボーディング資料、手順書に変換します。',
      },
    ],
    howItWorks: {
      badge: '進め方',
      title: '会話から信頼できるナレッジカバレッジへ',
      description:
        'Knowledge Harvestはトピック設計、インタビュー、ドキュメント化のすべてを連携させ、重要なノウハウを失わない仕組みを提供します。',
      steps: [
        '企業の背景を入力してナレッジツリーを作成し、優先度付きのインタビューテーマを数分で入手します。',
        'ガイド付きの音声インタビューを実施。AIが状況に合わせて質問し、きれいな書き起こしを自動生成します。',
        'リアルタイムでカバレッジを追跡し、オンボーディングや業務マニュアルに使えるドキュメントを出力します。',
      ],
      snapshot: {
        title: 'カバレッジのスナップショット',
        description: '強みと弱点の領域をひと目で把握できます。',
        topics: [
          { name: '安全プロトコル', value: '86%' },
          { name: '保守手順', value: '62%' },
          { name: '設備設定', value: '44%' },
        ],
      },
      queue: {
        title: '次に聞くべき質問',
        items: [
          'どのような条件でラインを再起動しますか？',
          'どの工具を週次で校正する必要がありますか？',
          '緊急の顧客課題をどのように優先順位づけしていますか？',
        ],
      },
    },
  },
  dashboard: {
    hero: {
      badge: 'カバレッジインサイト',
      title: 'ナレッジカバレッジダッシュボード',
      description:
        'トピック別の進捗と信頼度を可視化し、最も効果的なインタビューに集中できます。',
      toggleMockOn: '実データを表示',
      toggleMockOff: 'モックデータを表示',
      docsEnabled: 'ドキュメントを生成',
      docsDisabled: 'ドキュメントを有効化するにはシードが必要です',
    },
    metrics: {
      coverage: {
        title: '全体カバレッジ',
        subtitle: 'ターゲット知識の取得率',
      },
      confidence: {
        title: '信頼度スコア',
        subtitle: 'インタビュー全体で検証済み',
      },
      topics: {
        title: 'カバー済みトピック',
        summary: 'カバレッジ50%超の高信頼トピック数を表示します。',
        suffix: '全{{total}}件中',
      },
      interviewSessions: {
        title: 'インタビューセッション',
        empty: 'ライブインタビューを同期すると、ここに進捗が表示されます。',
        nonEmpty: '記録済みのセッションから獲得したナレッジを確認できます。',
      },
    },
    coverageSection: {
      title: 'トピック別カバレッジ詳細',
      subtitle: 'ギャップや信頼度の推移、次のアクションを掘り下げて把握します。',
      loading: '最新のカバレッジ指標を取得しています…',
      emptyTitle: 'まだカバレッジがありません',
      emptySubtitle: 'トピックをシードし、インタビューを開始すると進捗が表示されます。',
      seedCta: 'トピックをシード',
      mockCta: 'モックデータを読み込む',
    },
    interviewsSection: {
      title: 'インタビュー履歴とハイライト',
      subtitle: '各セッションの時間や生成されたナレッジ量をトラッキングします。',
      startCta: '新しいインタビューを開始',
      loading: 'インタビューセッションを読み込み中…',
      emptyTitle: 'まだインタビューがありません',
      emptySubtitle: '最初のセッションを開始して専門知をキャプチャしましょう。',
      primaryCta: 'インタビューを開始',
      secondaryCta: 'トピックをシード',
      audioBadge: '音声を保存',
      docLink: 'ドキュメントを表示',
    },
    admin: {
      title: 'メンテナンス',
      description: 'すべての企業・インタビュー・保存音声を削除して環境を初期化します。',
      button: 'データをリセット',
      buttonBusy: 'リセット中…',
      confirm: 'データベースと音声ファイルが完全に削除されます。続行しますか？',
      success: 'すべてのデータを削除しました。',
      error: 'リセットに失敗しました。もう一度お試しください。',
    },
    cards: {
      defaultSpeaker: '担当エキスパート',
      metrics: {
        duration: '所要時間',
        knowledge: 'ナレッジ項目',
        messages: '記録されたメッセージ',
      },
      coverage: {
        answeredTemplate: '全{{total}}問中{{answered}}問に回答済み',
        coverageLabel: 'カバレッジ',
        confidenceLabel: '信頼度',
        nextQuestions: '次に質問する項目',
      },
    },
  },
  seed: {
    title: 'シードトピック',
    subtitle: '必要な領域から整理し、ナレッジが増えるたびにブラッシュアップできます。',
    dashboardLink: 'ダッシュボードを見る →',
    assistantLabel: 'インテークアシスタント',
    assistant: {
      placeholderActive: '回答を入力してEnterキーを押してください…',
      placeholderComplete: '準備完了です。上のアクションから別の領域をシードできます。',
      mappingIndicator: 'トピックを整理しています…',
      send: '送信',
      errorRequired: '先に簡単な回答を入力してください。',
      skipTag: '[スキップ]',
      completeHint: '別の領域を追加したい場合は、左側のアクションから再度インテークを実行してください。',
      intros: {
        new: 'まずは基本情報を集めて、すぐ使えるトピックマップを用意します。',
        extend: '{{company}}のマップは既にあります。重複を避けるため、追加したい領域を教えてください。',
        extendFallback: 'この会社',
      },
      prompts: {
        companyName: 'まず会社名を教えてください。',
        companyUrl: '参考にできる公開URLはありますか？（任意）',
        focusNew: '最初にドキュメント化したい製品・部門・知識領域はどこですか？',
        focusExtend: '次に拡張したい製品・部門・知識領域はどこですか？',
        descriptionNew: '会社の運営スタイルがわかるように簡単な説明を教えてください。',
        descriptionExtend: '今回のアップデートで意識したいポイントや背景を簡単に共有してください。',
      },
      mappingCue: '了解です。トピックマップを整理します…',
      success: '完了しました。下にスクロールして更新されたマップを確認するか、すぐにインタビューへ進めます。',
      failure: 'トピックの取得で問題が発生しました。上の内容を確認して、もう一度お試しください。',
    },
    focusSuggestions: [
      '新入社員オンボーディング',
      '製造プロセス',
      '重要設備の保守',
      'カスタマーサポート手順',
      '安全・コンプライアンス対応',
    ],
    panels: {
      currentTitle: '現在のマップ',
      extend: '拡張する',
      newCompany: '新しい会社を追加',
      promptsReady: '質問が準備できています',
      reminder: '一度に1領域ずつ拡張し、必要に応じて後から別の部門を追加できます。',
      firstTimeTitle: '初めての会社ですか？',
      firstTimeDescription:
        '会社名、任意のURL、最初に記録したい領域を共有してください。インタビューで使えるコンパクトなトピックリストを返します。',
      examplesTitle: '入力例',
      examples: [
        '会社名：「Acme Precision Parts」',
        'フォーカス領域：「CNC加工の品質チェック」',
        '説明：担当チームやプロセス、課題を2〜3文で',
      ],
      tipsTitle: 'ヒント',
      tips: [
        'できるだけ具体的に（「製造現場の新人研修」など）。',
        '別の部門や製品を追加したいときは、いつでも再度インテークを実行できます。',
      ],
    },
    topicPreview: {
      weightLabel: '重み',
      followUps: '追質問の準備完了',
    },
    results: {
      badge: '生成されたマップ',
      title: 'トピックツリーのプレビュー',
      companyLabel: '企業',
      startInterview: 'インタビューを開始',
      viewDashboard: 'ダッシュボードを見る',
    },
  },
  interview: {
    hero: {
      badge: 'インタビュースタジオ',
      title: 'ナレッジインタビュー',
      description:
        '音声中心のインタビューを実施し、リアルタイムで書き起こしとカバレッジ分析に反映します。',
      descriptionWithCompany:
        '{{company}} - 音声中心のインタビューを実施し、リアルタイムで書き起こしとカバレッジ分析に反映します。',
      companyReady: '企業情報が設定済み (ID: {{id}})',
      companyMissing: 'インタビューを開始するにはトピックツリーを生成してください',
      sessionLabel: 'セッション #{{id}}',
    },
    status: {
      connecting: '接続中',
      active: 'ライブ',
      ended: '保存済み',
      idle: '待機中',
    },
    connection: {
      recording: '録音中',
      connecting: '接続処理中…',
      ready: '開始待ち',
      dropped: 'リアルタイム接続が切断されました。再度インタビューを開始してください。',
    },
    buttons: {
      stop: 'インタビューを停止',
      stopPending: '停止中…',
      start: 'インタビューを開始',
      startPending: '開始準備中…',
    },
    errors: {
      missingCompany: 'まずはシードページでトピックツリーを生成してください。',
      session: 'リアルタイムセッションでエラーが発生しました。再度お試しください。',
      startFailed: 'インタビューを開始できませんでした',
      persistFailed: 'インタビューの保存に失敗しました',
      realtimeCredentials: 'リアルタイムセッションの認証情報が不足しています。',
      realtimeOfferRejected: 'Azure RealtimeサービスがWebRTCオファーを拒否しました。モデル設定を確認してください。',
      transcription: '音声認識で問題が発生しました: {{message}}',
    },
    transcript: {
      title: 'ライブ書き起こし',
      assistantLabel: 'AIインタビュアー',
      userLabel: 'あなた',
      empty: '「インタビューを開始」を押して記録を始めましょう。',
    },
    postSession: {
      title: 'インタビューを保存しました',
      description: '書き起こし・音声・カバレッジを保存しました。次に実行する操作を選んでください。',
      dashboard: 'ダッシュボードを見る',
      docs: 'ドキュメントを見る',
      restart: '別のインタビューを開始',
      tip: 'ヒント: ダッシュボードのインタビュー履歴からいつでもセッションを再確認できます。',
    },
    coverage: {
      title: 'カバレッジ進捗',
      subtitle: '会話が優先領域をどのように埋めているかを追跡します。',
      syncing: '最近のセッションからカバレッジを同期しています…',
      empty: '最初のトピックが記録されるとカバレッジが表示されます。',
      suggestedTitle: '追跡したいフォローアップ',
      suggestedEmpty: '優先度の高いトピックの基礎情報をまず押さえましょう。',
      suggestedItemPrefix: 'さらに深掘り:',
      suggestedItemSuffix: '（現在のカバレッジ {{coverage}}%、信頼度 {{confidence}}%）',
      metricLabel: '信頼度',
    },
    queue: {
      currentTitle: '現在の質問',
      empty: 'キューは空です。必要ならシードページでターゲットを追加してください。',
      markAnswered: '回答済みにする',
      skip: '後で聞く',
      requiredTag: '必須',
      optionalTag: '任意',
      feedbackPrompt: 'この質問は役立ちましたか？',
      feedbackPositive: '役立った',
      feedbackNegative: '改善が必要',
      pendingCount: '残り{{count}}件',
      nextTitle: '次に予定している質問',
      nextEmpty: '次の質問はありません。',
      completedTitle: '今回カバーした質問',
      completedEmpty: 'まだ記録された質問はありません。',
    },
    speaker: {
      liveActivity: '話者アクティビティ',
      assistant: 'AIインタビュアー',
      user: 'あなた',
      speaking: '話しています',
    },
    timer: {
      elapsedLabel: '経過時間',
      remainingLabel: '残り時間',
      autoWrapCountdown: '{{seconds}}後に自動終了',
      instructions: {
        timeboxed: 'このセッションは{{minutes}}分です。残り3分になったら要点をまとめて締めに入りましょう。',
        unlimited: '制限時間はありません。話し手が疲れた様子なら休憩と振り返りを提案してください。',
        unlimitedWithReminder: '制限時間はありませんが、{{minutes}}分ごとに短い休憩を促し、要点を確認しましょう。',
      },
      options: {
        heading: 'インタビュー時間',
        guidance: 'AIが自動で終了を促すタイミングを選択してください。',
        pendingResume: '前回の自動保存タイマーを使用します。',
        '15': {
          label: '15分',
          description: '短時間でポイントを整理したいときに最適です。',
        },
        '30': {
          label: '30分',
          description: '深掘りしても疲れにくい長さです。',
        },
        unlimited: {
          label: '無制限',
          description: '手動終了。必要ならリマインダーを設定できます。',
        },
      },
      unlimitedReminder: {
        label: '休憩リマインダー',
        none: 'リマインダーなし',
        every: '{{minutes}}分ごとに通知',
      },
      reminders: {
        fiveMinutes: '残り5分です。まとめに入りましょう。',
        twoMinutes: '残り2分です。重要事項を確認しましょう。',
        oneMinute: '残り1分です。最後の確認をお願いします。',
        autowrap: '時間になりました。延長しなければ自動終了します。',
        unlimited: '無制限モードです。定期的に休憩を提案してください。',
      },
      autosaveIdle: '自動保存待機中',
      autosaveSaving: '自動保存中…',
      autosaveError: '自動保存に失敗しました',
      autosaveRetry: '再保存する',
      autosaveFallbackError: '自動保存に失敗しました。しばらくしてから再試行します。',
      resume: {
        title: '前回のセッションを再開しますか？',
        description: '{{updated}} に自動保存しました。続きから再開するか破棄してください。',
        fallbackTimestamp: '前回のセッション',
        continueCta: '再開する',
        discardCta: '破棄する',
        timer: {
          timeboxed: '{{minutes}}分のタイマーで保存されています。',
          unlimited: '制限時間なしで保存されています。',
        },
      },
      wrapModal: {
        title: 'そろそろ終了しましょうか？',
        description: '予定した時間に到達しました。今すぐ終了するか、5分延長できます。{{countdown}}後に自動終了します。',
        extend: '5分延長する',
        extendDisabled: '延長は1回までです',
        stop: '今すぐ終了する',
      },
    },
    ai: {
      instructions:
        'あなたは現場の運用知識を丁寧に引き出すインタビュアーです。オープンな質問で尊重を持って会話を導き、重要なポイントを整理してください。',
    },
    defaults: {
      topics: [
        { id: 'products_services', name: '製品・サービス' },
        { id: 'processes', name: 'プロセス' },
        { id: 'equipment', name: '設備' },
        { id: 'safety', name: '安全' },
      ],
    },
  },
};

export type { Dictionary };

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  ja,
};

export const DEFAULT_LOCALE: Locale = 'ja';

export function resolveLocale(candidate?: string | null): Locale {
  if (!candidate) {
    return DEFAULT_LOCALE;
  }
  const normalized = candidate.toLowerCase();
  return normalized === 'en' ? 'en' : 'ja';
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
