import { Download } from 'lucide-react';
import { ReservationFilters, ReservationTable } from '@/components/reservations';
import { Head, qs } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { eventOptions, listReservations, staffOptions, type SP } from '@/lib/queries';
export const metadata = { title: 'Reservations' };
export default async function P({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole('admin'); const sp = await searchParams;
  const d = await db(async (q) => ({ ...(await listReservations(q, sp)), events: await eventOptions(q), staff: await staffOptions(q) }));
  return <><Head title="Reservations" sub={`${d.total} ${d.total === 1 ? 'reservation' : 'reservations'}`}><a className="btn ghost" href={`/api/export/reservations${qs(sp, { format: 'csv', page: '' })}`}><Download size={16} />CSV</a><a className="btn ghost" href={`/api/export/reservations${qs(sp, { format: 'xlsx', page: '' })}`}><Download size={16} />Excel</a></Head><ReservationFilters sp={sp} events={d.events} staff={d.staff} /><ReservationTable rows={d.rows} total={d.total} sp={sp} base="/admin/reservations" /></>;
}
