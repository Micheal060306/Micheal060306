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
  return <main className="auth"><div className="card stack"><Brand /><div><h1>Sign in</h1><p className="muted">For administrators and staff.</p></div>
    {ready && <div className="msg ok">Your password is set. Sign in to continue.</div>}
    <ActionForm action={login} className="stack"><Field l="Email"><input name="email" type="email" autoComplete="username" required /></Field><Field l="Password"><input name="password" type="password" autoComplete="current-password" required /></Field><button className="btn block">Sign in</button></ActionForm>
    <p className="small muted">Forgotten your password? Ask an administrator for a new sign-in link.</p></div></main>;
}
