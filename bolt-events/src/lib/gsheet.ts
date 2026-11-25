// Minimal Google Sheets client: service-account sign-in (RS256 JWT) and a full rewrite of one tab.
// No dependencies, so it can run in unit tests. Base URLs can be pointed at a mock for tests.
import { createSign } from 'node:crypto';

export type ServiceAccount = { client_email: string; private_key: string };
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const tokenUrl = () => process.env.GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token';
const apiUrl = () => process.env.GOOGLE_SHEETS_URL ?? 'https://sheets.googleapis.com';

export class SheetError extends Error { permanent: boolean; constructor(message: string, permanent = false) { super(message); this.permanent = permanent; } }

/** Accepts a full spreadsheet URL or a bare ID. */
export function parseSpreadsheetId(s: string): string | null {
  const v = s.trim(), m = v.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(v) ? v : null;
}
/** Extracts the two fields we need from a downloaded service-account key file. */
export function parseServiceAccount(json: string): ServiceAccount | null {
  try {
    const j = JSON.parse(json);
    if (typeof j?.client_email !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(j.client_email)) return null;
    if (typeof j?.private_key !== 'string' || !j.private_key.includes('PRIVATE KEY')) return null;
    return { client_email: j.client_email, private_key: j.private_key };
  } catch { return null; }
}
export function validSheetName(s: string) { return s.length >= 1 && s.length <= 90 && !/[\[\]*?:\/\\']/.test(s); }

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
export function signJwt(sa: ServiceAccount, now = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key);
  return `${head}.${claims}.${b64url(sig)}`;
}

const cache = new Map<string, { token: string; until: number }>();
async function token(sa: ServiceAccount): Promise<string> {
  const hit = cache.get(sa.client_email);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  let jwt: string;
  try { jwt = signJwt(sa); } catch { throw new SheetError('The service account private key could not be read. Paste the key file again.', true); }
  const r = await fetch(tokenUrl(), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }), signal: AbortSignal.timeout(15_000), redirect: 'error' });
  const j: any = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) throw new SheetError(`Google sign-in failed: ${j?.error_description ?? j?.error ?? `HTTP ${r.status}`}`, r.status >= 400 && r.status < 500);
  cache.set(sa.client_email, { token: j.access_token, until: Date.now() + Number(j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}

async function call(sa: ServiceAccount, method: string, path: string, body?: unknown) {
  const r = await fetch(apiUrl() + path, { method, headers: { authorization: `Bearer ${await token(sa)}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000), redirect: 'error' });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = j?.error?.message ?? `HTTP ${r.status}`;
    if (r.status === 403 || r.status === 404) throw new SheetError(`Google Sheets refused access (${msg}). Share the spreadsheet with ${sa.client_email} as Editor and check the link.`, true);
    throw new SheetError(`Google Sheets error: ${msg}`, r.status >= 400 && r.status < 500 && r.status !== 429);
  }
  return j;
}

/** Replaces the whole tab with a header row plus rows. Creates the tab and adds grid rows when needed. Values are written RAW, never as formulas. */
export async function writeSheet(sa: ServiceAccount, spreadsheetId: string, tab: string, columns: string[], rows: (string | number | null)[][]) {
  const id = encodeURIComponent(spreadsheetId), q = `'${tab}'`;
  const meta = await call(sa, 'GET', `/v4/spreadsheets/${id}?fields=sheets.properties(sheetId,title,gridProperties)`);
  let sheet = meta?.sheets?.map((s: any) => s.properties).find((p: any) => p.title === tab);
  const need = rows.length + 1, width = columns.length;
  if (!sheet) {
    const r = await call(sa, 'POST', `/v4/spreadsheets/${id}:batchUpdate`, { requests: [{ addSheet: { properties: { title: tab, gridProperties: { rowCount: Math.max(need, 100), columnCount: Math.max(width, 26), frozenRowCount: 1 } } } }] });
    sheet = r?.replies?.[0]?.addSheet?.properties;
    if (sheet?.sheetId != null) await call(sa, 'POST', `/v4/spreadsheets/${id}:batchUpdate`, { requests: [{ repeatCell: { range: { sheetId: sheet.sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } }] });
  } else {
    const g = sheet.gridProperties ?? {}, more: any[] = [];
    if ((g.rowCount ?? 0) < need) more.push({ appendDimension: { sheetId: sheet.sheetId, dimension: 'ROWS', length: need - (g.rowCount ?? 0) } });
    if ((g.columnCount ?? 0) < width) more.push({ appendDimension: { sheetId: sheet.sheetId, dimension: 'COLUMNS', length: width - (g.columnCount ?? 0) } });
    if (more.length) await call(sa, 'POST', `/v4/spreadsheets/${id}:batchUpdate`, { requests: more });
  }
  // write first, then clear what is left below, so the sheet is never empty mid-sync
  await call(sa, 'PUT', `/v4/spreadsheets/${id}/values/${encodeURIComponent(`${q}!A1`)}?valueInputOption=RAW`, { majorDimension: 'ROWS', values: [columns, ...rows.map((r) => r.map((c) => c ?? ''))] });
  await call(sa, 'POST', `/v4/spreadsheets/${id}/values/${encodeURIComponent(`${q}!A${need + 1}:ZZ`)}:clear`, {});
  return rows.length;
}
