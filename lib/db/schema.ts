import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url'),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const topicTrees = sqliteTable('topic_trees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id),
  topicData: text('topic_data').notNull(), // JSON stringified topic tree
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const interviewSessions = sqliteTable('interview_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id),
  topicTreeId: integer('topic_tree_id').references(() => topicTrees.id),
  speakerName: text('speaker_name'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  audioUrl: text('audio_url'),
  transcript: text('transcript'),
  status: text('status').notNull(), // 'active', 'completed', 'failed'
});

export const qaTurns = sqliteTable('qa_turns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => interviewSessions.id),
  topicId: text('topic_id'),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  speakerLabel: text('speaker_label'),
});

export const knowledgeAtoms = sqliteTable('knowledge_atoms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => interviewSessions.id),
  topicId: text('topic_id').notNull(),
  type: text('type').notNull(), // 'procedure', 'parameter', 'risk', 'vendor', 'troubleshooting'
  title: text('title').notNull(),
  content: text('content').notNull(), // JSON stringified content (steps, values, etc.)
  sourceSpan: text('source_span'), // e.g., "00:03:11-00:05:04"
  confidence: real('confidence'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const coverageScores = sqliteTable('coverage_scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id),
  topicId: text('topic_id').notNull(),
  targetQuestions: integer('target_questions').notNull(),
  answeredQuestions: integer('answered_questions').notNull(),
  confidence: real('confidence').notNull(),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull(),
});

export const exportJobs = sqliteTable('export_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id),
  format: text('format').notNull(), // 'notion', 'docx', 'html'
  status: text('status').notNull(), // 'pending', 'completed', 'failed'
  outputUrl: text('output_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
