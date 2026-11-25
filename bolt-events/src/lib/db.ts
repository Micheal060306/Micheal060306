import 'server-only';
import pg from 'pg';

pg.types.setTypeParser(1082, (v) => v); // date  -> 'YYYY-MM-DD'
pg.types.setTypeParser(1182 as any, (v: string) => (v === '{}' ? [] : v.slice(1, -1).split(','))); // date[]

export type Row = Record<string, any>;
export type Tx = (sql: string, params?: unknown[]) => Promise<Row[]>;

const g = globalThis as unknown as { boltPool?: pg.Pool };
function pool() {
  if (!g.boltPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
    g.boltPool = new pg.Pool({
      connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000,
      ssl: local || process.env.DATABASE_SSL === 'disable' ? false
        : { rejectUnauthorized: process.env.DATABASE_SSL !== 'no-verify', ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') || undefined },
    });
    g.boltPool.on('error', (e) => console.error('database pool error', e.message));
  }
  return g.boltPool;
}

/** Runs fn in one transaction under the given session token ('' = anonymous). Deadlocks are retried. */
export async function tx<T>(token: string, fn: (q: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const c = await pool().connect();
    let broken: Error | undefined;
    try {
      await c.query('begin');
      await c.query(`select set_config('app.session', $1, true), set_config('search_path', 'bolt', true)`, [token]);
      const out = await fn(async (sql, params) => (await c.query(sql, params as any[])).rows);
      await c.query('commit');
      return out;
    } catch (e: any) {
      await c.query('rollback').catch((x) => { broken = x; });
      if (attempt < 4 && (e?.code === '40P01' || e?.code === '40001')) continue;
      throw e;
    } finally { c.release(broken); }
  }
}

export const anon: Tx = (sql, params) => tx('', (q) => q(sql, params));

/** Business errors raised by the database (SQLSTATE BExxx) carry user-safe messages. */
export function publicError(e: any): { status: number; message: string } {
  if (typeof e?.code === 'string' && /^BE\d{3}$/.test(e.code)) return { status: Number(e.code.slice(2)), message: e.message };
  if (e?.constraint === 'slot_not_overbooked') return { status: 409, message: 'Capacity cannot be lower than the number of confirmed bookings.' };
  if (e?.code === '23503' || e?.code === '23001') return { status: 409, message: 'This record is in use by existing reservations, so it cannot be removed.' };
  if (e?.code === '23505') return { status: 409, message: 'That entry already exists.' };
  if (e?.code === '23514') return { status: 422, message: 'Some values are outside the allowed range. Please check and try again.' };
  if (e?.code === '42501') return { status: 403, message: 'You do not have permission to do this.' };
  console.error(e);
  return { status: 500, message: 'Something went wrong. Please try again.' };
}
