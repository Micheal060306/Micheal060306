// Applies db/migrations/*.sql in order, once each, as the database owner (MIGRATION_DATABASE_URL),
// then sets the bolt_app login password from BOLT_APP_PASSWORD.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { loadEnv, sslFor } from './env.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

export async function migrate({ url, appPassword, log = console.log }) {
  const db = new pg.Client({ connectionString: url, ssl: sslFor(url) });
  await db.connect();
  try {
    await db.query('select pg_advisory_lock(726001)');
    await db.query('create schema if not exists bolt');
    await db.query('create table if not exists bolt.schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    await db.query('alter table bolt.schema_migrations enable row level security');
    const done = new Set((await db.query('select name from bolt.schema_migrations')).rows.map((r) => r.name));
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      if (done.has(f)) continue;
      await db.query('begin');
      try {
        await db.query(readFileSync(path.join(dir, f), 'utf8'));
        await db.query('insert into bolt.schema_migrations (name) values ($1)', [f]);
        await db.query('commit');
        log('applied', f);
      } catch (e) { await db.query('rollback'); throw new Error(`${f}: ${e.message} ${e.where ?? ''}`); }
    }
    if (appPassword) await db.query(`alter role bolt_app with login password ${db.escapeLiteral(appPassword)}`);
    const { rows } = await db.query(`select rolsuper or rolbypassrls as bad from pg_roles where rolname = 'bolt_app'`);
    if (rows[0]?.bad) throw new Error('bolt_app must not be superuser or BYPASSRLS');
  } finally { await db.end(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  loadEnv();
  const { MIGRATION_DATABASE_URL: url, BOLT_APP_PASSWORD: appPassword } = process.env;
  if (!url) { console.error('MIGRATION_DATABASE_URL is required'); process.exit(1); }
  await migrate({ url, appPassword });
  console.log('Database is up to date.');
}
