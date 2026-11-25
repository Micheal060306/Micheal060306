import 'server-only';
import nodemailer from 'nodemailer';
import { anon, type Row } from './db';
import { appUrl } from './auth';
import { manageToken } from './crypto';
import { fmtLong, fmtRange } from './format';
import { getIntegration, webhookUrlOk } from './integrations';

class Permanent extends Error {}
export function variables(n: Row): Record<string, string> {
  return {
    participant_name: n.participant_name ?? '', event_name: n.event_name ?? '', reference: n.reference ?? '',
    date: n.starts_at ? fmtLong(n.starts_at) : '', time: n.starts_at ? fmtRange(n.starts_at, n.ends_at) : '',
    location: n.meeting_link || n.location || '', staff_name: n.staff_name ?? '',
    manage_link: n.idem ? `${appUrl()}/booking/manage?t=${manageToken(n.idem)}` : '', event_link: n.event_slug ? `${appUrl()}/events/${n.event_slug}` : '',
  };
}
export const render = (t: string, v: Record<string, string>) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => v[k] ?? '');

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000), redirect: 'error' });
  const raw = (await r.text()).slice(0, 5000);
  let json: any = null; try { json = JSON.parse(raw); } catch { /* not JSON */ }
  if (!r.ok) throw r.status >= 400 && r.status < 500 && r.status !== 429 ? new Permanent(`HTTP ${r.status}: ${raw.slice(0, 200)}`) : new Error(`HTTP ${r.status}`);
  return json;
}

/** Sends one message. Returns the provider's id only when the provider itself confirms acceptance. */
async function send(n: Row, c: Record<string, string>): Promise<string> {
  const v = variables(n), body = render(n.body, v);
  const params = n.type === 'staff_assignment' ? [v.staff_name, v.event_name, v.reference, v.date, v.time] : [v.participant_name, v.event_name, v.reference, v.date, v.time];
  switch (n.channel) {
    case 'email': {
      const t = nodemailer.createTransport({ host: c.host, port: Number(c.port), secure: Number(c.port) === 465, requireTLS: process.env.ALLOW_INSECURE_WEBHOOKS !== '1' && Number(c.port) !== 465, auth: { user: c.user, pass: c.pass }, connectionTimeout: 15_000 });
      const i = await t.sendMail({ from: c.from, to: n.recipient, subject: render(n.subject, v), text: body });
      if (!i.accepted?.length) throw new Permanent('Mail server did not accept the recipient.');
      return i.messageId ?? 'accepted';
    }
    case 'whatsapp': {
      const base = process.env.WHATSAPP_BASE_URL ?? 'https://graph.facebook.com';
      const msg = n.provider_template
        ? { type: 'template', template: { name: n.provider_template, language: { code: c.language || 'en' }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] } }
        : { type: 'text', text: { body } };
      const j = await post(`${base}/${c.api_version || 'v23.0'}/${encodeURIComponent(c.phone_number_id)}/messages`, { messaging_product: 'whatsapp', to: n.recipient.replace('+', ''), ...msg }, { authorization: `Bearer ${c.access_token}` });
      if (!j?.messages?.[0]?.id) throw new Permanent('WhatsApp did not confirm the message.');
      return j.messages[0].id;
    }
    case 'aisensy': {
      if (!n.provider_template) throw new Permanent('Set the AiSensy campaign name on this template.');
      const j = await post(process.env.AISENSY_URL ?? 'https://backend.aisensy.com/campaign/t1/api/v2', { apiKey: c.api_key, campaignName: n.provider_template, destination: n.recipient, userName: v.participant_name || v.staff_name, templateParams: params });
      if (String(j?.success) !== 'true') throw new Permanent('AiSensy did not confirm the message.');
      return String(j.submitted_message_id ?? 'accepted');
    }
    default: {
      if (!webhookUrlOk(c.webhook_url)) throw new Permanent('The Pabbly webhook URL must be a public https address.');
      const { body: _b, subject: _s, provider_template: _p, idem: _i, attempts: _a, recipient: _r, ...data } = n;
      await post(c.webhook_url, { ...data, message: body, manage_link: v.manage_link, date: v.date, time: v.time });
      return 'accepted';
    }
  }
}

/** Processes due notifications. Safe to run concurrently: rows are claimed with SKIP LOCKED. */
export async function dispatch(limit = 25) {
  const jobs = (await anon('select claim_notifications($1) j', [limit])).map((r) => r.j);
  const out = { sent: 0, failed: 0, retry: 0, not_configured: 0 };
  await Promise.all(jobs.map(async (n) => {
    const finish = (s: string, id: string | null, err: string | null, at: Date | null = null) => anon('select finish_notification($1,$2,$3,$4,$5)', [n.id, s, id, err, at]);
    const cfg = await getIntegration(n.channel);
    if (!cfg.enabled || !cfg.complete) { out.not_configured++; await finish('not_configured', null, 'Integration is not configured.'); return; }
    let id: string;
    try { id = await send(n, cfg.values); } catch (e: any) {
      if (e instanceof Permanent || n.attempts >= 4) { out.failed++; await finish('failed', null, e.message); } else { out.retry++; await finish('pending', null, e.message, new Date(Date.now() + 2 ** n.attempts * 60_000)); }
      return;
    }
    out.sent++; await finish('sent', id, null);
  }));
  return out;
}

/** Sends an invitation by email if SMTP is configured; true only when the mail server accepted it. */
export async function sendInvite(to: string, name: string, link: string) {
  const cfg = await getIntegration('email');
  if (!cfg.enabled || !cfg.complete) return false;
  try {
    await send({ channel: 'email', type: 'invite', recipient: to, subject: 'Your Bolt Events staff account', body: `Hi ${name},\n\nYou have been invited to Bolt Events. Set your password using this link (valid for 72 hours):\n\n${link}\n\nBolt Academy`.replace(/\{\{/g, '{ {') }, cfg.values);
    return true;
  } catch (e: any) { console.error('invite email failed:', e.message); return false; }
}
