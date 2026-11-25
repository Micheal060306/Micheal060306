import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { body, caught, error, json, sameOrigin } from '@/lib/api';
import { clientIp, rateLimit } from '@/lib/auth';
import { manageToken } from '@/lib/crypto';
import { anon } from '@/lib/db';
import { dispatch } from '@/lib/notify';
import { clean, firstIssue, mobile, optional, text, uuid } from '@/lib/validate';
const token = z.string().min(20).max(100);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('lookup'), reference: z.string().max(30).transform((s) => clean(s).toUpperCase()), mobile }),
  z.object({ action: z.literal('cancel'), token, reason: optional(text(0, 500, 'Reason', true)) }),
  z.object({ action: z.literal('reschedule'), token, slot: uuid }),
]);
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error('Request not allowed.', 403);
  const p = schema.safeParse(await body(req));
  if (!p.success) return error(firstIssue(p.error), 422);
  const v = p.data;
  try {
    if (!(await rateLimit(`manage:ip:${clientIp(req.headers)}`, 40, 600))) return error('Too many attempts. Please wait a few minutes and try again.', 429);
    if (v.action === 'lookup') {
      if (!(await rateLimit(`lookup:${v.reference}`, 6, 900))) return error('Too many attempts. Please wait a few minutes and try again.', 429);
      const [{ idem }] = await anon('select booking_idem_by_reference($1,$2) idem', [v.reference, v.mobile]);
      return idem ? json({ token: manageToken(idem) }) : error('No booking matches that booking ID and mobile number.', 404);
    }
    if (v.action === 'cancel') await anon('select participant_cancel($1,$2)', [v.token, v.reason ?? null]);
    else await anon('select participant_reschedule($1,$2)', [v.token, v.slot]);
    after(() => dispatch().catch((e) => console.error('dispatch', e.message)));
    return json({ done: true });
  } catch (e) { return caught(e); }
}
