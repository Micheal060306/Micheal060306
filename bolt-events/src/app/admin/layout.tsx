import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth';
export default async function L({ children }: { children: ReactNode }) { const u = await requireRole('admin'); return <Shell role="admin" name={u.full_name}>{children}</Shell>; }
