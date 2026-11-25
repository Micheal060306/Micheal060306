// Builds db/setup-all-in-one.sql: every migration in one script for a NEW database, to paste into
// the Supabase SQL editor (no Node.js needed on your computer). It also creates the bolt_app login
// and your administrator account, and prints a one-time link where you choose the admin password.
// Run after adding a migration:  node scripts/build-setup-sql.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), dir = path.join(root, 'db', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const out = `-- =====================================================================================
-- Bolt Events: complete database setup for a NEW database (Supabase SQL editor)
-- Generated from db/migrations by scripts/build-setup-sql.mjs. Do not edit by hand.
--
-- 1. Change the three values in the SETTINGS block just below.
-- 2. Paste this whole file into Supabase: SQL Editor, New query. Click Run.
-- 3. The result shows your admin "set password" link (valid 72 hours). Open it once the site is live.
-- Run it once. Later updates use: npm run db:migrate (it skips what this script already applied).
-- =====================================================================================

begin;

create temp table bolt_setup (k text primary key, v text not null);
insert into bolt_setup values
  ('admin_email',  'you@example.com'),                 -- <- your admin sign-in email
  ('app_password', 'CHANGE-ME-to-a-long-random-password'), -- <- password for the bolt_app database login (save it: it goes in DATABASE_URL)
  ('site_url',     'https://events.example.com');      -- <- your website address, no trailing slash

do $$ begin
  if (select v from bolt_setup where k = 'admin_email') = 'you@example.com' then raise exception 'Edit admin_email in the SETTINGS block first.'; end if;
  if (select v from bolt_setup where k = 'app_password') like 'CHANGE-ME%' or length((select v from bolt_setup where k = 'app_password')) < 16 then raise exception 'Set app_password to a random password of at least 16 characters (letters and digits).'; end if;
  if (select v from bolt_setup where k = 'app_password') !~ '^[A-Za-z0-9._~-]+$' then raise exception 'Use only letters, digits and . _ ~ - in app_password, so it works inside DATABASE_URL.'; end if;
  if (select v from bolt_setup where k = 'site_url') !~ '^https://[^/]+$' then raise exception 'site_url must look like https://events.example.com (no trailing slash).'; end if;
  if exists (select 1 from pg_namespace where nspname = 'bolt') then raise exception 'This database already has Bolt Events. Use npm run db:migrate for updates.'; end if;
end $$;

create schema bolt;
create table bolt.schema_migrations (name text primary key, applied_at timestamptz not null default now());
alter table bolt.schema_migrations enable row level security;

${files.map((f) => `-- ===== ${f} =====\n${readFileSync(path.join(dir, f), 'utf8').trim()}\ninsert into bolt.schema_migrations (name) values ('${f}');\nreset search_path;\n`).join('\n')}
-- ===== bolt_app login and administrator =====
do $$ begin execute format('alter role bolt_app with login password %L', (select v from bolt_setup where k = 'app_password')); end $$;
do $$ begin
  if (select rolsuper or rolbypassrls from pg_roles where rolname = 'bolt_app') then raise exception 'bolt_app must not be superuser or BYPASSRLS'; end if;
end $$;
create temp table bolt_invite as
with a as (
  insert into bolt.profiles (email, full_name, role) values (lower((select v from bolt_setup where k = 'admin_email')), 'Administrator', 'admin') returning id
), t as (select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') tok)
select a.id, t.tok from a, t;
insert into bolt.auth_tokens (token_hash, profile_id, expires_at) select sha256(convert_to(tok, 'UTF8')), id, now() + interval '72 hours' from bolt_invite;

commit;

select 'Setup complete' as status,
  (select v from bolt_setup where k = 'site_url') || '/invite?t=' || (select tok from bolt_invite) as admin_set_password_link,
  'Open this link after the site is live to choose your admin password (valid 72 hours).' as next_step;
`;
writeFileSync(path.join(root, 'db', 'setup-all-in-one.sql'), out);
console.log(`db/setup-all-in-one.sql written (${files.length} migrations).`);
