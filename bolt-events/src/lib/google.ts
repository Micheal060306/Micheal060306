// Shared Google service-account sign-in (RS256 JWT bearer flow). No dependencies, so unit tests can import it.
import { createSign } from 'node:crypto';

export type ServiceAccount = { client_email: string; private_key: string };
export const SCOPES = { sheets: 'https://www.googleapis.com/auth/spreadsheets', calendar: 'https://www.googleapis.com/auth/calendar.events' } as const;
const tokenUrl = () => process.env.GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token';

/** An error from Google. permanent = retrying without a settings change will not help. */
export class GoogleError extends Error { permanent: boolean; status: number; constructor(message: string, permanent = false, status = 0) { super(message); this.permanent = permanent; this.status = status; } }

/** Extracts the two fields we need from a downloaded service-account key file. */
export function parseServiceAccount(json: string): ServiceAccount | null {
  try {
    const j = JSON.parse(json);
    if (typeof j?.client_email !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(j.client_email)) return null;
    if (typeof j?.private_key !== 'string' || !j.private_key.includes('PRIVATE KEY')) return null;
    return { client_email: j.client_email, private_key: j.private_key };
  } catch { return null; }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
export function signJwt(sa: ServiceAccount, scope: string, now = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key);
  return `${head}.${claims}.${b64url(sig)}`;
}

const cache = new Map<string, { token: string; until: number }>();
export async function googleToken(sa: ServiceAccount, scope: string): Promise<string> {
  const key = `${sa.client_email} ${scope}`, hit = cache.get(key);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  let jwt: string;
  try { jwt = signJwt(sa, scope); } catch { throw new GoogleError('The service account private key could not be read. Paste the key file again.', true); }
  const r = await fetch(tokenUrl(), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }), signal: AbortSignal.timeout(15_000), redirect: 'error' });
  const j: any = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) throw new GoogleError(`Google sign-in failed: ${j?.error_description ?? j?.error ?? `HTTP ${r.status}`}`, r.status >= 400 && r.status < 500, r.status);
  cache.set(key, { token: j.access_token, until: Date.now() + Number(j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}

/** One authorised JSON call. Errors carry the HTTP status so callers can word them. */
export async function googleCall(sa: ServiceAccount, scope: string, url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { authorization: `Bearer ${await googleToken(sa, scope)}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000), redirect: 'error' });
  const j: any = r.status === 204 ? {} : await r.json().catch(() => null);
  if (!r.ok) throw new GoogleError(j?.error?.message ?? `HTTP ${r.status}`, r.status >= 400 && r.status < 500 && r.status !== 429, r.status);
  return j;
}
