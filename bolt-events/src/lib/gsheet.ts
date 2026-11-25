// Minimal Google Sheets client: a full rewrite of one tab. Base URLs can be pointed at a mock for tests.
import { GoogleError, SCOPES, googleCall, parseServiceAccount, signJwt as sign, type ServiceAccount } from './google.ts';

export type { ServiceAccount };
export { parseServiceAccount };
export const SheetError = GoogleError;
const apiUrl = () => process.env.GOOGLE_SHEETS_URL ?? 'https://sheets.googleapis.com';
export const signJwt = (sa: ServiceAccount, now?: number) => sign(sa, SCOPES.sheets, now);

/** Accepts a full spreadsheet URL or a bare ID. */
export function parseSpreadsheetId(s: string): string | null {
  const v = s.trim(), m = v.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(v) ? v : null;
}
export function validSheetName(s: string) { return s.length >= 1 && s.length <= 90 && !/[\[\]*?:\/\\']/.test(s); }

async function call(sa: ServiceAccount, method: string, path: string, body?: unknown) {
  try { return await googleCall(sa, SCOPES.sheets, apiUrl() + path, method, body); } catch (e) {
    if (!(e instanceof GoogleError) || !e.status) throw e;
    if (e.status === 403 || e.status === 404) throw new GoogleError(`Google Sheets refused access (${e.message}). Share the spreadsheet with ${sa.client_email} as Editor and check the link.`, true, e.status);
    throw new GoogleError(`Google Sheets error: ${e.message}`, e.permanent, e.status);
  }
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
