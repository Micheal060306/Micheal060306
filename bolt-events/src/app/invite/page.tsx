import { ActionForm } from '@/components/action-form';
import { Brand } from '@/components/brand';
import { Field } from '@/components/ui';
import { acceptInvite } from '../login/actions';
export const metadata = { title: 'Set your password' };
export default async function Invite({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = '' } = await searchParams;
  return <main className="auth"><div className="card stack"><Brand /><div><h1>Set your password</h1><p className="muted">Use at least 10 characters.</p></div>
    <ActionForm action={acceptInvite} className="stack" hidden={{ token: t }}><Field l="New password"><input name="password" type="password" autoComplete="new-password" minLength={10} required /></Field><Field l="Confirm password"><input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></Field><button className="btn block">Save password</button></ActionForm></div></main>;
}
