'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
export function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
  const [s, set] = useState('');
  return <button type="button" className="btn ghost sm" onClick={async () => {
    try { await navigator.clipboard.writeText(text); set('Copied'); } catch { window.prompt('Copy this link', text); }
    setTimeout(() => set(''), 1800);
  }}>{s ? <Check size={14} /> : <Copy size={14} />}{s || label}</button>;
}
/** A select that applies its filter form as soon as it changes. */
export function AutoSelect(p: React.ComponentProps<'select'>) { return <select {...p} onChange={(e) => e.target.form?.requestSubmit()} />; }
