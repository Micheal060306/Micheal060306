"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

const METRICS = [
  { label: "CTR", value: 4.7, suffix: "%", decimals: 1 },
  { label: "CPL", value: 312, prefix: "₹", decimals: 0 },
  { label: "ROAS", value: 3.8, suffix: "x", decimals: 1 },
  { label: "Conv. Rate", value: 6.2, suffix: "%", decimals: 1 },
];

/**
 * Illustrative reporting view, not a real client's numbers — labeled as a
 * sample so it's never mistaken for a claimed result.
 */
export function CampaignDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  return (
    <div ref={ref} className="border border-line-strong">
      <div className="flex items-center justify-between px-8 py-5 hairline-b">
        <span className="font-mono-label text-ink-faint">Sample reporting view</span>
        <span className="font-mono-label text-ink-faint flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          Live campaign
        </span>
      </div>
      <div className="grid sm:grid-cols-4">
        {METRICS.map((m, i) => (
          <div key={m.label} className={`p-8 ${i > 0 ? "sm:border-l border-line" : ""}`}>
            <p className="font-mono-label text-ink-faint mb-4">{m.label}</p>
            <p className="text-[32px] tabular">
              {m.prefix}
              <CountUp target={m.value} decimals={m.decimals} play={inView && !reduced} />
              {m.suffix}
            </p>
          </div>
        ))}
      </div>
      <div className="px-8 pb-8 pt-2">
        <MiniChart play={inView && !reduced} />
      </div>
    </div>
  );
}

function CountUp({ target, decimals, play }: { target: number; decimals: number; play: boolean }) {
  const [value, setValue] = useState(play ? 0 : target);

  useEffect(() => {
    if (!play) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1200;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, target]);

  return <>{value.toFixed(decimals)}</>;
}

function MiniChart({ play }: { play: boolean }) {
  const points = [22, 30, 26, 40, 38, 52, 48, 61, 58, 70, 66, 78];
  const max = Math.max(...points);
  const w = 600;
  const h = 90;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${i * step},${h - (p / max) * h}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <path
        d={d}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1.5"
        strokeDasharray={play ? undefined : "0 1"}
        style={
          play
            ? { strokeDasharray: 1000, strokeDashoffset: 0, transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)" }
            : { strokeDasharray: 1000, strokeDashoffset: 1000 }
        }
      />
    </svg>
  );
}
