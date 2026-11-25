import { EventForm } from '@/components/event-form';
import { Head } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { istDate } from '@/lib/format';
export const metadata = { title: 'Create event' };
export default async function P() { await requireRole('admin'); return <><Head title="Create event" sub="Slots are generated automatically from your working hours." /><EventForm min={istDate()} /></>; }
