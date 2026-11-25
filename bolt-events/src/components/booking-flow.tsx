'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { readAttribution } from './attribution';
import { SlotPicker, type Slot } from './slot-picker';

const newId = () => { const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
export function BookingFlow({ event, initial }: { event: { slug: string; closed: boolean; status: string; deadline: string | null }; initial: Slot[] }) {
  const router = useRouter();
  const [slots, setSlots] = useState(initial), [closed, setClosed] = useState(event.closed);
  const [day, setDay] = useState(initial.find((s) => s.remaining > 0)?.date ?? initial[0]?.date ?? '');
  const [pick, setPick] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const idem = useRef(''), form = useRef<HTMLFormElement>(null);
  const refresh = useCallback(async () => {
    try { const r = await fetch(`/api/public/events/${encodeURIComponent(event.slug)}`, { cache: 'no-store' }); if (r.ok) { const j = await r.json(); setSlots(j.slots); setClosed(j.closed); return j.slots as Slot[]; } } catch { /* keep showing what we have; the server validates again */ }
    return null;
  }, [event.slug]);
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) void refresh(); }, 30_000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { // tell the visitor as soon as their chosen slot is gone
    if (!pick || busy) return; const s = slots.find((x) => x.id === pick);
    if (!s || s.remaining < 1) { setPick(''); setErr('The time you selected is no longer available. Please choose another.'); }
  }, [slots, pick, busy]);
  useEffect(() => { if (slots.length && !slots.some((s) => s.date === day)) { setDay(slots[0].date); } }, [slots, day]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const f = new FormData(e.currentTarget); setBusy(true); setErr(''); idem.current ||= newId();
    try {
      const r = await fetch('/api/public/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slot: pick, name: f.get('name'), mobile: f.get('mobile'), email: f.get('email'), message: f.get('message'), idem: idem.current, marketing: readAttribution() }) });
      const j = await r.json();
      if (r.ok) { router.push(`/booking/confirmation?t=${j.token}`); return; }
      idem.current = ''; setErr(j.error); setBusy(false);
      if (r.status === 409 || r.status === 404) { const now = await refresh(); const s = now?.find((x) => x.id === pick); if (now && (!s || s.remaining < 1)) setPick(''); }
    } catch { // the request may have reached the server: keep the key so a retry cannot book twice
      setErr('We could not reach the server. Check your connection and try again; you will not be booked twice.'); setBusy(false);
    }
  }
  if (event.status === 'cancelled' || event.status === 'completed') return <div className="card"><h2>{event.status === 'cancelled' ? 'This event has been cancelled' : 'This event has ended'}</h2><p className="muted">Bookings are no longer available.</p></div>;
  if (closed) return <div className="card"><h2>Registration is closed</h2><p className="muted">{event.deadline ? 'The registration deadline for this event has passed.' : 'This event is not accepting bookings.'}</p></div>;
  if (!slots.length) return <div className="card"><h2>No times available</h2><p className="muted">There are no upcoming appointment times for this event.</p></div>;
  return <div className="card stack"><h2>Reserve your appointment</h2>
    <SlotPicker slots={slots} day={day} onDay={(d) => { setDay(d); setPick(''); setErr(''); }} value={pick} onPick={(id) => { if (id !== pick) idem.current = ''; setPick(id); setErr(''); setTimeout(() => form.current?.scrollIntoView({ block: 'nearest' }), 30); }} />
    {err && <div className="msg err" role="alert">{err}</div>}
    {pick && <form ref={form} onSubmit={submit}><div className="stepn"><i>3</i>Your details</div><fieldset disabled={busy} className="stack" style={{ gap: 14 }}>
      <label className="f"><span className="req">Full name</span><input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
      <label className="f"><span className="req">Mobile number</span><input name="mobile" type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} placeholder="98765 43210" /></label>
      <label className="f">Email address (optional)<input name="email" type="email" autoComplete="email" maxLength={254} /></label>
      <label className="f">Additional message (optional)<textarea name="message" maxLength={1000} /></label>
      <button className="btn block">{busy ? 'Confirming…' : 'Confirm reservation'}</button></fieldset></form>}</div>;
}
