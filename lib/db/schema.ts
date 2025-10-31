import { pgTable, serial, text, integer, real, timestamp } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const topicTrees = pgTable('topic_trees', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  topicData: text('topic_data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const interviewSessions = pgTable('interview_sessions', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  topicTreeId: integer('topic_tree_id').references(() => topicTrees.id, { onDelete: 'set null' }),
  speakerName: text('speaker_name'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  audioUrl: text('audio_url'),
  transcript: text('transcript'),
  status: text('status').notNull(),
});

export const qaTurns = pgTable('qa_turns', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => interviewSessions.id, { onDelete: 'cascade' }),
  topicId: text('topic_id'),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  speakerLabel: text('speaker_label'),
});

export const knowledgeAtoms = pgTable('knowledge_atoms', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => interviewSessions.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  sourceSpan: text('source_span'),
  confidence: real('confidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const coverageScores = pgTable('coverage_scores', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull(),
  targetQuestions: integer('target_questions').notNull(),
  answeredQuestions: integer('answered_questions').notNull(),
  confidence: real('confidence').notNull(),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull(),
});

export const exportJobs = pgTable('export_jobs', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  format: text('format').notNull(),
  status: text('status').notNull(),
  outputUrl: text('output_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
