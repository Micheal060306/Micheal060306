import { existsSync, readFileSync } from 'node:fs';
export function loadEnv() {
  for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);
}
export const sslFor = (url) => {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  return local || process.env.DATABASE_SSL === 'disable' ? false
    : { rejectUnauthorized: process.env.DATABASE_SSL !== 'no-verify', ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') || (process.env.DATABASE_CA_FILE ? readFileSync(process.env.DATABASE_CA_FILE, 'utf8') : undefined) };
};
