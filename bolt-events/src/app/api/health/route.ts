import { json } from '@/lib/api';
import { anon } from '@/lib/db';
export async function GET() { try { await anon('select 1'); return json({ status: 'ok' }); } catch { return json({ status: 'unavailable' }, 503); } }
