'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookingCard } from './booking-card';
import { SlotPicker, type Slot } from './slot-picker';
async function call(body: object) {
  try { const r = await fetch('/api/public/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { ok: r.ok, ...(await r.json()) }; } catch { return { ok: false, error: 'We could not reach the server. Please try again.' }; }
}
export function ManageBooking({ token, booking: b, slots, badLink }: { token: string; booking: any; slots: Slot[]; badLink: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false), [err, setErr] = useState(badLink ? 'That link is not valid. Find your booking below.' : ''), [mode, setMode] = useState<'' | 'move' | 'cancel'>('');
  const [day, setDay] = useState(slots.find((s) => s.remaining > 0)?.date ?? ''), [pick, setPick] = useState('');
  const run = async (body: object, done: (j: any) => void) => { setBusy(true); setErr(''); const j = await call(body); setBusy(false); if (j.ok) done(j); else { setErr(j.error); setPick(''); if (token) router.refresh(); } };
  const lookup = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void run({ action: 'lookup', reference: f.get('reference'), mobile: f.get('mobile') }, (j) => router.replace(`/booking/manage?t=${j.token}`)); };
  if (!b) return <div className="narrow card stack"><div><h1>Manage your booking</h1><p className="muted">Enter your booking ID and the mobile number you booked with.</p></div>{err && <div className="msg err" role="alert">{err}</div>}
    <form onSubmit={lookup}><fieldset className="stack" disabled={busy}><label className="f">Booking ID<input name="reference" required maxLength={20} placeholder="BE-XXXXXXXX" autoCapitalize="characters" /></label><label className="f">Mobile number<input name="mobile" type="tel" required maxLength={20} /></label><button className="btn">{busy ? 'Searching…' : 'Find booking'}</button></fieldset></form></div>;
  return <div className="narrow card stack"><div className="row between"><h1>Your booking</h1><b>{b.reference}</b></div><BookingCard b={b} />{err && <div className="msg err" role="alert">{err}</div>}
    {!b.can_change && <p className="small muted">{b.status === 'cancelled' ? 'This booking is cancelled. You can make a new booking from the event page.' : 'This booking can no longer be changed online.'}</p>}
    {b.can_change && !mode && <div className="row"><button className="btn" disabled={!slots.length} onClick={() => setMode('move')}>Reschedule</button><button className="btn danger" onClick={() => setMode('cancel')}>Cancel booking</button></div>}
    {mode === 'move' && <div className="stack"><h2>Choose a new time</h2><SlotPicker slots={slots} day={day} onDay={(d) => { setDay(d); setPick(''); }} value={pick} onPick={setPick} exclude={b.slot_id} /><div className="row"><button className="btn" disabled={!pick || busy} onClick={() => run({ action: 'reschedule', token, slot: pick }, () => router.refresh())}>{busy ? 'Saving…' : 'Confirm new time'}</button><button className="btn ghost" onClick={() => setMode('')}>Keep current time</button></div></div>}
    {mode === 'cancel' && <form onSubmit={(e) => { e.preventDefault(); void run({ action: 'cancel', token, reason: new FormData(e.currentTarget).get('reason') }, () => router.refresh()); }}><fieldset disabled={busy} className="stack"><label className="f">Reason (optional)<textarea name="reason" maxLength={500} /></label><div className="row"><button className="btn danger">{busy ? 'Cancelling…' : 'Yes, cancel my booking'}</button><button type="button" className="btn ghost" onClick={() => setMode('')}>Keep booking</button></div></fieldset></form>}
    <Link className="small" href={`/events/${b.event_slug}`}>Go to event page</Link></div>;
}
