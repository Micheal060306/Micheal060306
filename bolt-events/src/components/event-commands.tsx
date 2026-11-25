import { eventCommand } from '@/app/admin/actions';
import { ActionForm } from './action-form';
export function EventCommands({ e, compact }: { e: any; compact?: boolean }) {
  const F = ({ cmd, t, confirm, danger }: { cmd: string; t: string; confirm?: string; danger?: boolean }) => <ActionForm action={eventCommand} hidden={{ id: e.id, cmd }} confirm={confirm} quiet={compact}><button className={`btn sm ${danger ? 'danger' : 'ghost'}`}>{t}</button></ActionForm>;
  return <>{e.status === 'published' ? <F cmd="unpublish" t="Unpublish" confirm={`Unpublish “${e.name}”? Its booking page stops working until you publish again. Existing bookings are kept.`} /> : <F cmd="publish" t="Publish" />}<F cmd="duplicate" t="Duplicate" />
    {!compact && e.status !== 'completed' && <F cmd="complete" t="Mark completed" confirm="Mark this event as completed? New bookings will stop." />}{!compact && e.status !== 'cancelled' && <F cmd="cancel" t="Cancel event" danger confirm="Cancel this event? All upcoming bookings will be cancelled too." />}<F cmd="delete" t="Delete" danger confirm={`Delete “${e.name}” permanently? This cannot be undone.`} /></>;
}
