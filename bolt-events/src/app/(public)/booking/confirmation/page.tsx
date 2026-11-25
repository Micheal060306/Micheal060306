import Link from 'next/link';
import { CircleCheck } from 'lucide-react';
import { BookingCard } from '@/components/booking-card';
import { CopyButton } from '@/components/client-bits';
import { appUrl } from '@/lib/auth';
import { anon } from '@/lib/db';
export const metadata = { title: 'Booking confirmation' };
export default async function Confirmation({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams; let b: any = null;
  if (t) try { b = (await anon('select booking_by_token($1) j', [t]))[0].j; } catch { /* shown as not found */ }
  if (!b) return <div className="narrow card stack"><h1>Booking not found</h1><p className="muted">This confirmation link is not valid. You can look up your booking with your booking ID and mobile number.</p><Link className="btn" href="/booking/manage">Find my booking</Link></div>;
  const active = b.status !== 'cancelled';
  return <div className="narrow card stack"><div className="row">{active && <CircleCheck size={34} color="var(--green)" />}<h1>{active ? 'Your appointment is booked' : 'This booking is cancelled'}</h1></div>
    <div className="refbox"><span className="small muted">Booking ID</span><b>{b.reference}</b></div><BookingCard b={b} />
    <p className="small muted">Keep your booking ID. You need it, with your mobile number, to change or cancel. The private link below opens this booking directly.</p>
    <div className="row"><Link className="btn" href={`/booking/manage?t=${t}`}>Manage booking</Link><CopyButton text={`${appUrl()}/booking/manage?t=${t}`} label="Copy private link" /></div></div>;
}
