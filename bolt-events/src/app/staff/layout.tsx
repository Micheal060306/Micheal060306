import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth';
export default async function L({ children }: { children: ReactNode }) { const u = await requireRole('staff'); return <Shell role="staff" name={u.full_name} collapsed={(await cookies()).get('bolt_sidebar')?.value === 'mini'}>{children}</Shell>; }
