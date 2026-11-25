'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { anon, publicError } from '@/lib/db';
import { COOKIE, clientIp, rateLimit, sessionToken, startSession, type ActionState } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { password } from '@/lib/validate';

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get('email') ?? '').slice(0, 254).trim().toLowerCase(), pw = String(fd.get('password') ?? '').slice(0, 200);
  const bad = { ok: false, message: 'Incorrect email or password.', at: Date.now() };
  if (!email || !pw) return bad;
  const ip = clientIp(await headers());
  if (!(await rateLimit(`login:ip:${ip}`, 30, 900)) || !(await rateLimit(`login:${email}`, 8, 900))) return { ok: false, message: 'Too many attempts. Please wait 15 minutes and try again.', at: Date.now() };
  const [u] = await anon('select * from auth_get_user($1)', [email]);
  const ok = await verifyPassword(pw, u?.password_hash);
  if (!ok || !u?.is_active) return bad;
  await startSession(u.id);
  return { ok: true, redirect: `/${u.role}/dashboard` };
}
export async function logout() {
  const t = await sessionToken();
  if (t) await anon('select delete_session($1)', [t]);
  (await cookies()).delete(COOKIE);
  redirect('/login');
}
export async function acceptInvite(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimit(`invite:${clientIp(await headers())}`, 20, 900))) return { ok: false, message: 'Too many attempts. Please try again later.', at: Date.now() };
  const p = password.safeParse(fd.get('password'));
  if (!p.success) return { ok: false, message: 'Password must be at least 10 characters.', at: Date.now() };
  if (p.data !== fd.get('confirm')) return { ok: false, message: 'The passwords do not match.', at: Date.now() };
  try { await anon('select consume_auth_token($1,$2)', [String(fd.get('token') ?? ''), await hashPassword(p.data)]); } catch (e) { return { ok: false, message: publicError(e).message, at: Date.now() }; }
  return { ok: true, redirect: '/login?ready=1' };
}
