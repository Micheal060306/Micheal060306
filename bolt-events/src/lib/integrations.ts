import 'server-only';
import { decrypt } from './crypto';
import { anon } from './db';

type Field = { name: string; label: string; secret?: boolean; placeholder?: string; type?: string };
export const INTEGRATIONS: Record<string, { title: string; blurb: string; fields: Field[]; required: string[] }> = {
  email: { title: 'Email (SMTP)', blurb: 'Sends through your own mail server, such as Zoho or Gmail Workspace.', required: ['host', 'port', 'from', 'user', 'pass'],
    fields: [{ name: 'host', label: 'SMTP host', placeholder: 'smtp.example.com' }, { name: 'port', label: 'Port', placeholder: '465' }, { name: 'user', label: 'Username' }, { name: 'from', label: 'From address', placeholder: 'Bolt Academy <events@example.com>' }, { name: 'pass', label: 'Password', secret: true }] },
  whatsapp: { title: 'WhatsApp Business API', blurb: 'Meta Cloud API. Set the approved template name on each WhatsApp template.', required: ['phone_number_id', 'access_token'],
    fields: [{ name: 'phone_number_id', label: 'Phone number ID' }, { name: 'api_version', label: 'API version', placeholder: 'v23.0' }, { name: 'language', label: 'Template language', placeholder: 'en' }, { name: 'access_token', label: 'Access token', secret: true }] },
  aisensy: { title: 'AiSensy', blurb: 'Set the AiSensy campaign name on each AiSensy template.', required: ['api_key'],
    fields: [{ name: 'api_key', label: 'API key', secret: true }] },
  pabbly: { title: 'Pabbly Connect', blurb: 'Posts every booking event to your Pabbly webhook, and receives calls at /api/webhooks/pabbly.', required: ['webhook_url'],
    fields: [{ name: 'webhook_url', label: 'Outgoing webhook URL', placeholder: 'https://connect.pabbly.com/…' }, { name: 'inbound_secret', label: 'Incoming secret (X-Bolt-Secret header)', secret: true }] },
  gsheet: { title: 'Google Sheets', blurb: 'Keeps a tab of your spreadsheet in sync with every reservation: new bookings, cancellations, reschedules, attendance and staff changes.', required: ['spreadsheet_id', 'client_email', 'private_key'],
    fields: [{ name: 'spreadsheet_id', label: 'Spreadsheet link or ID', placeholder: 'https://docs.google.com/spreadsheets/d/…' }, { name: 'sheet_name', label: 'Tab name', placeholder: 'Reservations' }, { name: 'service_account', label: 'Service account key (JSON file contents)', secret: true, type: 'textarea' }] },
  gcal: { title: 'Google Calendar', blurb: 'Adds every booking to a shared academy calendar, so staff get Google Calendar reminders on their phones. Reschedules move the event and cancellations mark it cancelled.', required: ['calendar_id', 'client_email', 'private_key'],
    fields: [{ name: 'calendar_id', label: 'Calendar ID', placeholder: 'abc123@group.calendar.google.com' }, { name: 'reminder_minutes', label: 'Reminder (minutes before)', placeholder: '30' }, { name: 'service_account', label: 'Service account key (JSON file contents)', secret: true, type: 'textarea' }] },
  meta: { title: 'Meta Lead Ads', blurb: 'Receives lead notifications at /api/webhooks/meta and stores them for future processing.', required: ['verify_token', 'app_secret'],
    fields: [{ name: 'verify_token', label: 'Verify token', secret: true }, { name: 'app_secret', label: 'App secret', secret: true }] },
};
export async function getIntegration(key: string) {
  const [r] = await anon('select * from get_integration($1)', [key]);
  let secrets: Record<string, string> = {};
  if (r?.secrets_encrypted) try { secrets = JSON.parse(decrypt(r.secrets_encrypted)); } catch { /* APP_SECRET changed */ }
  const values = { ...(r?.config ?? {}), ...secrets } as Record<string, string>;
  return { enabled: !!r?.enabled, values, complete: INTEGRATIONS[key]?.required.every((f) => values[f]) ?? true };
}
/** Outgoing webhooks must be https and must not point at this server's own network. */
export function webhookUrlOk(u: string) {
  try {
    const x = new URL(u);
    if (process.env.ALLOW_INSECURE_WEBHOOKS === '1') return true;
    return x.protocol === 'https:' && !x.username && x.hostname.includes('.') && !/^[\d.]+$/.test(x.hostname) && !x.hostname.startsWith('[') && !/\.(local|internal|localhost)$/.test(x.hostname);
  } catch { return false; }
}
