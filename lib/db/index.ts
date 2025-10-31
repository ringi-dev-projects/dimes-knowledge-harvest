import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
type PostgresClient = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __db__: DrizzleDb | undefined;
  // eslint-disable-next-line no-var
  var __db_client__: PostgresClient | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

const client: PostgresClient =
  global.__db_client__ ??
  postgres(connectionString, {
    ssl: 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 20,
  });

const dbInstance: DrizzleDb = global.__db__ ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== 'production') {
  global.__db_client__ = client;
  global.__db__ = dbInstance;
}

export const db = dbInstance;

export async function closeDb() {
  if (process.env.NODE_ENV === 'production') {
    await client.end({ timeout: 5 });
  }
}
