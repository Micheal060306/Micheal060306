import { after, type NextRequest } from 'next/server';
import { body, caught, error, json, sameOrigin } from '@/lib/api';
import { clientIp, rateLimit } from '@/lib/auth';
import { manageToken } from '@/lib/crypto';
import { anon } from '@/lib/db';
import { dispatch } from '@/lib/notify';
import { bookingSchema, firstIssue } from '@/lib/validate';
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error('Request not allowed.', 403);
  const p = bookingSchema.safeParse(await body(req));
  if (!p.success) return error(firstIssue(p.error), 422);
  const v = p.data;
  try {
    if (!(await rateLimit(`book:ip:${clientIp(req.headers)}`, Number(process.env.BOOKING_LIMIT_PER_IP ?? 30), 600)) || !(await rateLimit(`book:m:${v.mobile}`, 15, 3600))) return error('Too many booking attempts. Please wait a few minutes and try again.', 429);
    const token = manageToken(v.idem);
    const [{ b }] = await anon('select book_slot($1,$2,$3,$4,$5,$6,$7,$8) b', [v.slot, v.name, v.mobile, v.email ?? null, v.message ?? null, v.idem, token, v.marketing ?? {}]);
    after(() => dispatch().catch((e) => console.error('dispatch', e.message)));
    return json({ reference: b.reference, token }, b.replayed ? 200 : 201);
  } catch (e) { return caught(e); }
}
