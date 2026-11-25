import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { anon, publicError, tx, type Row, type Tx } from './db';
import { firstIssue } from './validate';
import { newToken } from './crypto';

export const COOKIE = 'bolt_session';
export type User = { id: string; email: string; full_name: string; role: 'admin' | 'staff'; staff_id: string | null; can_reschedule: boolean };
export type ActionState = { ok: boolean; message?: string; redirect?: string; link?: string; at?: number } | null;

export const sessionToken = async () => (await cookies()).get(COOKIE)?.value ?? '';
export const getUser = cache(async (): Promise<User | null> => {
  const t = await sessionToken();
  return t ? (((await tx(t, (q) => q('select * from whoami()')))[0] as User) ?? null) : null;
});
export async function requireRole(role: 'admin' | 'staff'): Promise<User> {
  const u = await getUser();
  if (!u) redirect('/login');
  if (u.role !== role) redirect(`/${u.role}/dashboard`);
  return u;
}
/** Read data as the signed-in user, under Row Level Security. */
export async function db<T = Row[]>(fn: (q: Tx) => Promise<T>): Promise<T> { return tx(await sessionToken(), fn); }

export async function startSession(profileId: string) {
  const h = await headers(), token = newToken();
  await anon('select create_session($1,$2,$3,$4)', [profileId, token, clientIp(h), h.get('user-agent') ?? '']);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 12 * 3600, secure: (process.env.APP_URL ?? '').startsWith('https://'),
  });
}
/** X-Forwarded-For entry written by our own proxy, counted from the right (TRUSTED_PROXY_HOPS, default 1) so clients cannot forge it. */
export function clientIp(h: Headers) {
  const list = (h.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1') || 1);
  return list[Math.max(0, list.length - hops)] || 'unknown';
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  return (await anon('select rate_limit_hit($1,$2,$3) ok', [key, limit, seconds]))[0].ok as boolean;
}

/** Wraps a server action: checks role, validates input, runs in one transaction, reports safe errors. */
export async function act<S extends z.ZodType>(role: 'admin' | 'staff' | 'any', schema: S, fd: FormData,
  fn: (q: Tx, v: z.output<S>, u: User) => Promise<ActionState | string>): Promise<ActionState> {
  const u = await getUser();
  if (!u) return { ok: false, message: 'Your session has ended. Please sign in again.', at: Date.now() };
  if (role !== 'any' && u.role !== role) return { ok: false, message: 'You do not have permission to do this.', at: Date.now() };
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: firstIssue(p.error), at: Date.now() };
  let r: ActionState | string;
  try { r = await db((q) => fn(q, p.data, u)); } catch (e) { return { ok: false, message: publicError(e).message, at: Date.now() }; }
  {
    revalidatePath('/', 'layout');
    // redirect on the server: the form may unmount before the browser could act on it
    if (r && typeof r === 'object' && r.redirect) redirect(r.redirect);
    return { ...(typeof r === 'string' ? { ok: true, message: r } : r ?? { ok: true }), at: Date.now() } as ActionState;
  }
}
export const fail = (message: string): never => { throw Object.assign(new Error(message), { code: 'BE422' }); };
export const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
