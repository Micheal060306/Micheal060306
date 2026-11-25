import { Calendar, monthOf } from '@/components/calendar';
import { db, requireRole } from '@/lib/auth';
import { reservationsBetween, type SP } from '@/lib/queries';
export const metadata = { title: 'Calendar' };
export default async function P({ searchParams }: { searchParams: Promise<SP> }) { await requireRole('admin'); const m = monthOf(await searchParams); return <Calendar m={m} rows={await db((q) => reservationsBetween(q, m.start, m.end))} base="/admin" />; }
