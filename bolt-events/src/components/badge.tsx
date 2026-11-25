import { label } from '@/lib/format';
const TONE: Record<string, string> = { confirmed: 'green', rescheduled: 'blue', cancelled: 'red', published: 'green', completed: 'blue', attended: 'green', checked_in: 'blue', no_show: 'red', active: 'green', blocked: 'red', public: 'orange', sent: 'green', failed: 'red', pending: 'amber', sending: 'amber', inactive: 'red', full: 'amber', online: 'blue' };
export const Badge = ({ v, text }: { v: string; text?: string }) => <span className={`badge ${TONE[v] ?? ''}`}>{text ?? label(v)}</span>;
