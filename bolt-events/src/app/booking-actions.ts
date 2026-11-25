'use server';
// Used by admin and staff. The database decides what each signed-in person may do.
import { after } from 'next/server';
import { z } from 'zod';
import { act, type ActionState } from '@/lib/auth';
import { dispatch } from '@/lib/notify';
import { optional, text, uuid } from '@/lib/validate';
type S = ActionState;
const kick = (r: S) => { if (r?.ok) after(() => dispatch().catch((e) => console.error('dispatch', e.message))); return r; };
export async function cancelReservation(_: S, fd: FormData): Promise<S> {
  return kick(await act('any', z.object({ id: uuid, reason: optional(text(0, 500, 'Reason', true)) }), fd, async (q, v) => { await q('select manage_cancel($1,$2)', [v.id, v.reason ?? null]); return 'Reservation cancelled.'; }));
}
export async function rescheduleReservation(_: S, fd: FormData): Promise<S> {
  return kick(await act('any', z.object({ id: uuid, slot: uuid }), fd, async (q, v) => { await q('select manage_reschedule($1,$2)', [v.id, v.slot]); return 'Reservation rescheduled.'; }));
}
export async function markAttendance(_: S, fd: FormData): Promise<S> {
  return kick(await act('any', z.object({ id: uuid, status: z.enum(['not_checked_in', 'checked_in', 'attended', 'no_show']) }), fd, async (q, v) => { await q('select set_attendance($1,$2)', [v.id, v.status]); return 'Attendance updated.'; }));
}
export async function addNote(_: S, fd: FormData): Promise<S> {
  return act('any', z.object({ id: uuid, note: text(1, 2000, 'Note', true) }), fd, async (q, v) => { await q('select add_note($1,$2)', [v.id, v.note]); return 'Note added.'; });
}
export async function assignStaff(_: S, fd: FormData): Promise<S> {
  return kick(await act('admin', z.object({ id: uuid, staff: optional(uuid) }), fd, async (q, v) => { await q('select assign_reservation($1,$2)', [v.id, v.staff ?? null]); return 'Assignment saved.'; }));
}
