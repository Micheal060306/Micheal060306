import { ReservationFilters, ReservationTable } from '@/components/reservations';
import { Head } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { eventOptions, listReservations, type SP } from '@/lib/queries';
export const metadata = { title: 'My reservations' };
export default async function P({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole('staff'); const sp = await searchParams, d = await db(async (q) => ({ ...(await listReservations(q, sp)), events: await eventOptions(q) }));
  return <><Head title="Reservations" sub="Bookings you are authorised to manage." /><ReservationFilters sp={sp} events={d.events} /><ReservationTable rows={d.rows} total={d.total} sp={sp} base="/staff/reservations" /></>;
}
