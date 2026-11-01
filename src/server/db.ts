import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@vercel/functions";
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import config from "../../neon";

export class DatabaseUnavailable extends Error {
  constructor() {
    super("Accounts are not available right now.");
    this.name = "DatabaseUnavailable";
  }
}

type Queryable = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;
};

type PostgresEnv = {
  databaseUrl: string;
  databaseUrlUnpooled: string;
};

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function postgresEnv(): PostgresEnv {
  if (!process.env.DATABASE_URL) throw new DatabaseUnavailable();
  if (process.env.DATABASE_URL_UNPOOLED) {
    const { postgres } = parseEnv(config, ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]);
    return postgres;
  }
  const { postgres } = parseEnv(config, ["DATABASE_URL"]);
  return { databaseUrl: postgres.databaseUrl, databaseUrlUnpooled: postgres.databaseUrl };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: postgresEnv().databaseUrl, max: 5 });
    attachDatabasePool(pool);
  }
  return pool;
}

export async function withDatabase<T>(run: (db: Queryable) => Promise<T>): Promise<T> {
  await ensureSchema();
  return run(getPool());
}

export async function withTransaction<T>(run: (db: Queryable) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new DatabaseUnavailable();
  ready ??= migrate().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  await ready;
}

async function migrate(): Promise<void> {
  const db = new Pool({ connectionString: postgresEnv().databaseUrlUnpooled, max: 1 });
  try {
    await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      active_tree_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trees (
      id text NOT NULL,
      owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      document jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, id)
    );
    CREATE TABLE IF NOT EXISTS shares (
      token text PRIMARY KEY,
      owner_id text NOT NULL,
      tree_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, tree_id),
      FOREIGN KEY (owner_id, tree_id) REFERENCES trees (owner_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS suggestions (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      tree_id text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY (owner_id, tree_id) REFERENCES trees (owner_id, id) ON DELETE CASCADE
    );
  `);
  } finally {
    await db.end();
  }
}

export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof DatabaseUnavailable) return true;
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "57P01";
}

export type { Queryable };
