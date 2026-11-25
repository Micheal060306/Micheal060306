import { ManageBooking } from '@/components/manage-booking';
import { anon } from '@/lib/db';
export const metadata = { title: 'Manage booking' };
export default async function Manage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams; let b: any = null, slots: any[] = [];
  if (t) try {
    b = (await anon('select booking_by_token($1) j', [t]))[0].j;
    if (b.can_change) { const e = (await anon('select public_event($1) j', [b.event_slug]))[0]?.j; if (e && !e.closed) slots = e.slots; }
  } catch { /* falls back to lookup */ }
  return <ManageBooking key={`${t}:${b?.slot_id}:${b?.status}`} token={b ? t! : ''} booking={b} slots={slots} badLink={!!t && !b} />;
}
