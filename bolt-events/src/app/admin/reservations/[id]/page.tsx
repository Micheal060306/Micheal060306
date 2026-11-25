import { notFound } from 'next/navigation';
import { ReservationDetail } from '@/components/reservation-detail';
import { db, requireRole } from '@/lib/auth';
import { getReservation, staffOptions } from '@/lib/queries';
export const metadata = { title: 'Reservation' };
export default async function P({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin'); const { id } = await params;
  const d = await db(async (q) => ({ data: await getReservation(q, id), staff: await staffOptions(q) })); if (!d.data) notFound();
  return <ReservationDetail data={d.data} role="admin" canReschedule staff={d.staff} />;
}
