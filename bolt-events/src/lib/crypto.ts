import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function key(purpose: string) {
  const s = process.env.APP_SECRET ?? '';
  if (s.length < 32) throw new Error('APP_SECRET must be at least 32 characters');
  return Buffer.from(hkdfSync('sha256', s, 'bolt-events', purpose, 32));
}
const OPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const kdf = (pw: string, salt: Buffer) => new Promise<Buffer>((ok, no) => scrypt(pw, salt, 64, OPT, (e, k) => (e ? no(e) : ok(k))));

export const newToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await kdf(pw, salt)).toString('base64')}`;
}
const DUMMY = `scrypt$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(64).toString('base64')}`;
/** Always performs the same work, so response time does not reveal whether an account exists. */
export async function verifyPassword(pw: string, stored: string | null | undefined) {
  const [, salt, hash] = (stored ?? DUMMY).split('$');
  const ok = timingSafeEqual(await kdf(pw, Buffer.from(salt, 'base64')), Buffer.from(hash, 'base64'));
  return ok && !!stored;
}
/** Booking management token, derivable from the booking's private idempotency key; only its hash is stored. */
export const manageToken = (idem: string) => createHmac('sha256', key('manage')).update(idem).digest('base64url');

export function encrypt(text: string) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key('secrets'), iv);
  const d = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), d]).toString('base64');
}
export function decrypt(data: string) {
  const b = Buffer.from(data, 'base64'), d = createDecipheriv('aes-256-gcm', key('secrets'), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}
export function safeEqual(a: string, b: string) {
  const h = (x: string) => createHmac('sha256', 'cmp').update(x).digest();
  return timingSafeEqual(h(a), h(b));
}
