// Topic Tree Types (from brainstorming.md)
export interface TopicTarget {
  id: string;
  q: string;
  required: boolean;
}

export interface Topic {
  id: string;
  name: string;
  weight: number;
  targets: TopicTarget[];
  children?: Topic[];
}

export interface TopicTree {
  company: string;
  topics: Topic[];
}

// Knowledge Atom Types (from brainstorming.md)
export interface ProcedureStep {
  n: number;
  text: string;
}

export interface KnowledgeAtomSource {
  session_id: string;
  speaker: string;
  span: string;
}

export interface KnowledgeAtom {
  topic_id: string;
  type: 'procedure' | 'parameter' | 'risk' | 'vendor' | 'troubleshooting';
  title: string;
  steps?: ProcedureStep[];
  parameters?: Record<string, number | string>;
  risks?: string[];
  source: KnowledgeAtomSource;
}

// Coverage Types
export interface CoverageMetrics {
  topicId: string;
  topicName: string;
  targetQuestions: number;
  answeredQuestions: number;
  coveragePercent: number;
  confidence: number;
  nextQuestions: string[];
  evidenceSummary?: CoverageEvidenceSummary[];
}

export interface CoverageEvidenceSummary {
  id: number;
  evidenceType: 'knowledge_atom' | 'qa_turn' | 'manual_note';
  confidence: number;
  excerpt: string | null;
  targetId?: string | null;
  knowledgeAtomId?: number | null;
  qaTurnId?: number | null;
  createdAt: string;
}

// Interview Types
export interface InterviewMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  topicId?: string;
}

export interface InterviewSession {
  id: number;
  companyId: number;
  speakerName?: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'completed' | 'failed';
  messages: InterviewMessage[];
}
