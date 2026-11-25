import { markAttendance } from '@/app/booking-actions';
import { ActionForm } from './action-form';
import { ATT } from './ui';
export function AttendanceButtons({ id, current, quiet }: { id: string; current: string; quiet?: boolean }) {
  return <ActionForm action={markAttendance} className="row" hidden={{ id }} quiet={quiet}>{ATT.map(([v, t]) => <button key={v} name="status" value={v} className={`btn sm ${v === current ? '' : 'ghost'}`} aria-pressed={v === current} disabled={v === current}>{t}</button>)}</ActionForm>;
}
