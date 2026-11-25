import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from '@/components/brand';
import { Attribution } from '@/components/attribution';
export default function L({ children }: { children: ReactNode }) {
  return <div className="pub"><Attribution /><header className="pubtop"><div className="wrap"><Brand /><Link className="btn ghost sm" href="/booking/manage">Manage booking</Link></div></header><main className="pubmain"><div className="wrap">{children}</div></main><footer className="foot"><div className="wrap row between"><span>Bolt Events by Bolt Academy</span><span>All times are in India Standard Time (IST)</span></div></footer></div>;
}
