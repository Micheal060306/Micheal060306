'use server';
import { z } from 'zod';
import { act, fail, rateLimit, type ActionState } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { mobile, optional, password, text } from '@/lib/validate';
export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  return act('any', z.object({ current: z.string().max(200), password, confirm: z.string().max(200) }), fd, async (q, v, u) => {
    if (!(await rateLimit(`pw:${u.id}`, 8, 900))) fail('Too many attempts. Please wait 15 minutes.');
    if (v.password !== v.confirm) fail('The new passwords do not match.');
    const [x] = await q('select password_hash from auth_get_user($1)', [u.email]);
    if (!(await verifyPassword(v.current, x?.password_hash))) fail('Your current password is incorrect.');
    await q('select change_own_password($1)', [await hashPassword(v.password)]);
    return 'Password changed. Other devices were signed out.';
  });
}
export async function saveOwnProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  return act('staff', z.object({ name: text(2, 100, 'Full name'), phone: optional(mobile) }), fd, async (q, v) => { await q('select update_own_staff_profile($1,$2)', [v.name, v.phone ?? null]); return 'Profile saved.'; });
}
