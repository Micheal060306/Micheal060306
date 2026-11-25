import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { appUrl } from './auth';
import { publicError } from './db';
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
export const error = (message: string, status: number) => json({ error: message }, status);
/** Browsers always send Origin on POST; reject other sites. */
export function sameOrigin(req: NextRequest) {
  const o = req.headers.get('origin'); if (!o) return true;
  try { return new URL(o).host === req.headers.get('host') || new URL(o).origin === new URL(appUrl()).origin; } catch { return false; }
}
export async function body(req: NextRequest, max = 20_000): Promise<any> {
  if (Number(req.headers.get('content-length') ?? 0) > max) return null;
  const t = await req.text(); if (t.length > max) return null;
  try { return JSON.parse(t); } catch { return null; }
}
export const caught = (e: unknown) => { const { status, message } = publicError(e); return error(message, status); };
