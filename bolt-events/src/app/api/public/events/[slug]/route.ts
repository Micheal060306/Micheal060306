import { caught, error, json } from '@/lib/api';
import { anon } from '@/lib/db';
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { const e = (await anon('select public_event($1) j', [(await params).slug]))[0]?.j; return e ? json({ closed: e.closed, slots: e.slots }) : error('Event not found.', 404); } catch (e) { return caught(e); }
}
