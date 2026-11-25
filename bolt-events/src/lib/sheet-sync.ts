import 'server-only';
import { anon } from './db';
import { SheetError, writeSheet } from './gsheet';
import { getIntegration } from './integrations';
import { RES_COLUMNS, resRow } from './queries';

/** Mirrors every reservation to the configured Google Sheet when something changed since the last sync. */
export async function syncSheet(): Promise<{ synced: number } | { error: string } | null> {
  const [{ t: changed }] = await anon('select sheet_sync_claim() t');
  if (!changed) return null; // disabled, up to date, already running, or backing off after an error
  try {
    const cfg = await getIntegration('gsheet'), v = cfg.values;
    if (!cfg.complete) throw new SheetError('Google Sheets is not fully configured.', true);
    const rows = (await anon('select sheet_reservations() j')).map((r) => resRow(r.j));
    const n = await writeSheet({ client_email: v.client_email, private_key: v.private_key }, v.spreadsheet_id, v.sheet_name || 'Reservations', RES_COLUMNS, rows);
    await anon('select sheet_sync_finish($1,$2,null)', [changed, n]);
    return { synced: n };
  } catch (e: any) {
    const msg = e instanceof SheetError ? e.message : `Sync failed: ${e?.message ?? 'unknown error'}`;
    await anon('select sheet_sync_finish($1,null,$2)', [changed, msg]).catch(() => {});
    return { error: msg };
  }
}
