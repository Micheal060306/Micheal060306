import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { caught, error, json } from '@/lib/api';
import { safeEqual } from '@/lib/crypto';
import { anon } from '@/lib/db';
import { getIntegration } from '@/lib/integrations';
export async function GET(req: NextRequest) { // Meta's subscription handshake
  const p = req.nextUrl.searchParams, c = await getIntegration('meta');
  if (c.enabled && c.values.verify_token && p.get('hub.mode') === 'subscribe' && safeEqual(p.get('hub.verify_token') ?? '', c.values.verify_token)) return new Response(p.get('hub.challenge') ?? '', { headers: { 'content-type': 'text/plain' } });
  return error('Not authorised.', 403);
}
export async function POST(req: NextRequest) {
  try {
    const c = await getIntegration('meta'), raw = (await req.text()).slice(0, 200_000);
    if (!c.enabled || !c.values.app_secret || !safeEqual(req.headers.get('x-hub-signature-256') ?? '', `sha256=${createHmac('sha256', c.values.app_secret).update(raw).digest('hex')}`)) return error('Not authorised.', 401);
    let data: any; try { data = JSON.parse(raw); } catch { return error('Invalid JSON.', 400); }
    for (const e of data?.entry ?? []) for (const ch of e?.changes ?? []) await anon('select record_webhook($1,$2,$3)', ['meta', ch?.value?.leadgen_id ? String(ch.value.leadgen_id) : null, JSON.stringify(ch)]);
    return json({ received: true });
  } catch (e) { return caught(e); }
}
