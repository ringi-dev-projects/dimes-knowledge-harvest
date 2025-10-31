import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;

function resolveDatabasePath(): string {
  const rawEnvPath = process.env.DATABASE_URL?.trim();

  if (!rawEnvPath) {
    const dataDir = path.join(process.cwd(), 'data');
    ensureDir(dataDir);
    return path.join(dataDir, 'knowledge-harvest.db');
  }

  const dbPath = rawEnvPath.startsWith('.')
    ? path.resolve(process.cwd(), rawEnvPath)
    : rawEnvPath;

  const dbDir = path.dirname(dbPath);
  if (shouldEnsureDir(dbDir)) {
    ensureDir(dbDir);
  }

  return dbPath;
}

function shouldEnsureDir(dir: string): boolean {
  const normalizedDir = path.normalize(dir);
  const normalizedCwd = path.normalize(process.cwd());

  return normalizedDir.startsWith(normalizedCwd) || normalizedDir.startsWith('/tmp');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function initializeDb() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const dbPath = resolveDatabasePath();

    // Create SQLite connection
    sqliteInstance = new Database(dbPath);
    sqliteInstance.pragma('journal_mode = WAL');

    // Create Drizzle instance
    dbInstance = drizzle(sqliteInstance, { schema });

    // Initialize tables
    initTables();

    console.log('Database initialized successfully at:', dbPath);

    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error('Database initialization failed');
  }
}

export const db = initializeDb();

// Initialize database tables
function initTables() {
  if (!sqliteInstance) {
    throw new Error('SQLite instance not initialized');
  }

  // Create tables if they don't exist
  sqliteInstance.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT,
      description TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topic_trees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      topic_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS interview_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      topic_tree_id INTEGER,
      speaker_name TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      audio_url TEXT,
      transcript TEXT,
      status TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (topic_tree_id) REFERENCES topic_trees(id)
    );

    CREATE TABLE IF NOT EXISTS qa_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      topic_id TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      speaker_label TEXT,
      FOREIGN KEY (session_id) REFERENCES interview_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_atoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      topic_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_span TEXT,
      confidence REAL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES interview_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS coverage_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      topic_id TEXT NOT NULL,
      target_questions INTEGER NOT NULL,
      answered_questions INTEGER NOT NULL,
      confidence REAL NOT NULL,
      last_updated INTEGER NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS export_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      output_url TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );
  `);

  console.log('Database tables initialized');
}

// Export function to safely close database connection
export function closeDb() {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    dbInstance = null;
    console.log('Database connection closed');
  }
}
