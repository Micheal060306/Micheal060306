// Creates an administrator, or resets that administrator's password.
// Reads ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD from the environment / .env.local.
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';
import { loadEnv, sslFor } from './env.mjs';

loadEnv();
const { MIGRATION_DATABASE_URL: url, ADMIN_EMAIL: email, ADMIN_NAME: name = 'Administrator', ADMIN_PASSWORD: pw } = process.env;
if (!url || !email || !pw || pw.length < 10) {
  console.error('Set MIGRATION_DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters).');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString('base64')}$${scryptSync(pw, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('base64')}`;
const db = new pg.Client({ connectionString: url, ssl: sslFor(url) });
await db.connect();
const r = await db.query(
  `insert into bolt.profiles (email, full_name, role, password_hash) values (lower($1), $2, 'admin', $3)
   on conflict (lower(email)) do update set password_hash = excluded.password_hash, is_active = true where profiles.role = 'admin'
   returning id`, [email.trim(), name, hash]);
await db.end();
console.log(r.rowCount ? 'Administrator account is ready.' : 'That email belongs to a staff account; nothing changed.');
