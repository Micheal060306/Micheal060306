'use client';
import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from '@/lib/auth';

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;
/** Submits to a server action without clearing fields on error; optional confirmation dialog. */
export function ActionForm({ action, children, className, confirm, resetOnOk, quiet, hidden }: {
  action: Action; children: ReactNode; className?: string; confirm?: string; resetOnOk?: boolean; quiet?: boolean; hidden?: Record<string, string>;
}) {
  const [state, run, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null), dlg = useRef<HTMLDialogElement>(null), held = useRef<FormData | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state?.ok) return;
    if (state.redirect) router.push(state.redirect);
    else if (resetOnOk) form.current?.reset();
  }, [state, router, resetOnOk]);
  const go = (fd: FormData) => startTransition(() => run(fd));
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null);
    if (confirm) { held.current = fd; dlg.current?.showModal(); } else go(fd);
  };
  return <>
    <form ref={form} className={className} onSubmit={submit}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <fieldset disabled={pending} style={{ display: 'contents' }}>{children}</fieldset>
      {state?.message && !(quiet && state.ok) && <div role="status" className={`msg ${state.ok ? 'ok' : 'err'}`}>{state.message}{state.link && <div className="stack-s" style={{ marginTop: 8 }}><input readOnly value={state.link} aria-label="Link" onFocus={(e) => e.target.select()} /></div>}</div>}
    </form>
    {confirm && <dialog ref={dlg}><div className="stack"><p className="b">{confirm}</p><div className="row" style={{ justifyContent: 'flex-end' }}>
      <button type="button" className="btn ghost" onClick={() => dlg.current?.close()}>Go back</button>
      <button type="button" className="btn" onClick={() => { dlg.current?.close(); if (held.current) go(held.current); }}>Yes, continue</button></div></div></dialog>}
  </>;
}
