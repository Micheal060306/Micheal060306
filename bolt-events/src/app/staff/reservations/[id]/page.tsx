import { notFound } from 'next/navigation';
import { ReservationDetail } from '@/components/reservation-detail';
import { db, requireRole } from '@/lib/auth';
import { getReservation } from '@/lib/queries';
export const metadata = { title: 'Reservation' };
export default async function P({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole('staff'), { id } = await params, data = await db((q) => getReservation(q, id)); if (!data) notFound();
  return <ReservationDetail data={data} role="staff" canReschedule={u.can_reschedule} staff={u.staff_id ? [{ id: u.staff_id, name: u.full_name }] : []} />;
}
