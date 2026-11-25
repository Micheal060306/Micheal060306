import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { Brand } from '@/components/brand';
import { Field } from '@/components/ui';
import { getUser } from '@/lib/auth';
import { login } from './actions';
export const metadata = { title: 'Sign in' };
export default async function Login({ searchParams }: { searchParams: Promise<{ ready?: string }> }) {
  const u = await getUser(); if (u) redirect(`/${u.role}/dashboard`);
  const { ready } = await searchParams;
  return <main className="auth split"><section className="auth-side dots" aria-hidden><div className="stack" style={{ gap: 28 }}><span className="brand"><img src="/bolt-logo.png" alt="" width={86} height={48} style={{ height: 48 }} /><span className="brand-tag">Events</span></span>
      <h2>Every event appointment.<em>One place.</em></h2>
      <ul><li>Publish events and share booking links</li><li>Slots that can never be overbooked</li><li>Reservations, attendance and staff in one dashboard</li><li>Reports and CSV or Excel exports</li></ul></div><p className="small">Bolt Academy</p></section>
    <div className="auth-form"><div className="card stack"><Brand onLight /><div><h1>Sign in</h1><p className="muted">For administrators and staff.</p></div>
    {ready && <div className="msg ok">Your password is set. Sign in to continue.</div>}
    <ActionForm action={login} className="stack"><Field l="Email"><input name="email" type="email" autoComplete="username" required /></Field><Field l="Password"><input name="password" type="password" autoComplete="current-password" required /></Field><button className="btn block">Sign in</button></ActionForm>
    <p className="small muted">Forgotten your password? Ask an administrator for a new sign-in link.</p></div></div></main>;
}
