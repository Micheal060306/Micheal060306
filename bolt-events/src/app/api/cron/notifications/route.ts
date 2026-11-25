import type { NextRequest } from 'next/server';
import { caught, error, json } from '@/lib/api';
import { safeEqual } from '@/lib/crypto';
import { dispatch } from '@/lib/notify';
export const maxDuration = 60;
async function run(req: NextRequest) {
  const s = process.env.CRON_SECRET ?? '';
  if (s.length < 16 || !safeEqual(req.headers.get('authorization') ?? '', `Bearer ${s}`)) return error('Not authorised.', 401);
  try { return json(await dispatch(100)); } catch (e) { return caught(e); }
}
export { run as GET, run as POST };
