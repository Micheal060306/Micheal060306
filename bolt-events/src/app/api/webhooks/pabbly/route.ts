import type { NextRequest } from 'next/server';
import { body, caught, error, json } from '@/lib/api';
import { safeEqual } from '@/lib/crypto';
import { anon } from '@/lib/db';
import { getIntegration } from '@/lib/integrations';
export async function POST(req: NextRequest) {
  try {
    const c = await getIntegration('pabbly');
    if (!c.enabled || !c.values.inbound_secret || !safeEqual(req.headers.get('x-bolt-secret') ?? '', c.values.inbound_secret)) return error('Not authorised.', 401);
    const d = await body(req, 100_000); if (!d || typeof d !== 'object') return error('Invalid JSON.', 400);
    const [{ ok }] = await anon('select record_webhook($1,$2,$3) ok', ['pabbly', d.id ? String(d.id) : null, JSON.stringify(d)]);
    return json({ received: true, duplicate: !ok });
  } catch (e) { return caught(e); }
}
