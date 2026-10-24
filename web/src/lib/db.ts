// One Postgres for both worlds: PGlite (a file under .data/) in local dev,
// a real Postgres (Supabase) when DATABASE_URL is set.
import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { files, decisions, messages, settings, activity } from "./schema";

type Db = PgDatabase<any, any, any>;

const SCHEMA_SQL = `
create table if not exists files (
  id text primary key,
  name text not null,
  kind text not null,
  week text,
  status text,
  title text,
  content text not null,
  created_at timestamptz not null
);
create index if not exists files_name_idx on files (name, created_at desc);
create table if not exists decisions (
  id serial primary key,
  file_name text not null,
  decision text not null,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists messages (
  id text primary key,
  role text not null,
  text text not null,
  stop_reason text,
  created_at timestamptz not null
);
create table if not exists settings (
  key text primary key,
  value text not null
);
create table if not exists activity (
  id text primary key,
  agent text not null,
  kind text not null,
  text text not null,
  created_at timestamptz not null
);
create index if not exists activity_agent_idx on activity (agent, created_at desc);
`;

let dbPromise: Promise<Db> | null = null;

async function open(): Promise<Db> {
  let db: Db;
  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    db = drizzle(postgres(process.env.DATABASE_URL, { prepare: false }));
  } else {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { PGlite } = await import("@electric-sql/pglite");
    const fs = await import("node:fs");
    const dir = process.env.PGLITE_DIR ?? ".data/pg";
    fs.mkdirSync(dir, { recursive: true });
    db = drizzle(new PGlite(dir));
  }
  for (const stmt of SCHEMA_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.execute(sql.raw(stmt));
  }
  return db;
}

export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

export { files, decisions, messages, settings, activity };
