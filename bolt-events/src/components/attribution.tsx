'use client';
import { useEffect } from 'react';
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'campaign_id', 'adset_id', 'ad_id'];
const STORE = 'bolt_attribution', DAYS = 30;
function capture() {
  const p = new URLSearchParams(location.search), a: Record<string, string> = {};
  for (const k of KEYS) { const v = p.get(k); if (v) a[k] = v.slice(0, 500); }
  // a new ad click replaces the previous one; a visit without parameters keeps it
  if (Object.keys(a).length) localStorage.setItem(STORE, JSON.stringify({ at: Date.now(), a: { ...a, landing_page: (location.pathname + location.search).slice(0, 1000) } }));
}
export function readAttribution(): Record<string, string> {
  try {
    capture();
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    if (s && Date.now() - s.at < DAYS * 864e5) return s.a;
  } catch { /* storage unavailable */ }
  return { landing_page: location.pathname };
}
export function Attribution() { useEffect(() => { try { capture(); } catch { /* storage unavailable */ } }, []); return null; }
