"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";

const STAGES = ["Attention", "Acquisition", "Conversion", "Retention", "Scale"];
const DISCIPLINES = ["Strategy", "Creative", "Media", "Technology", "Analytics"];

/**
 * The signature Zeralytics section: a pinned, scroll-scrubbed walk through
 * the five stages of the growth engine. Built with GSAP ScrollTrigger per
 * the brief; falls back to a plain stacked reveal under reduced motion.
 */
export function GrowthEngine() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Reading the user's motion preference is a one-time sync with the
      // platform on mount (the same pattern Framer Motion's own
      // useReducedMotion hook uses internally), not state drifting from
      // a render value — safe to disable the cascading-render check here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinned(false);
      return;
    }

    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !wrapRef.current) return;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        const st = ScrollTrigger.create({
          trigger: wrapRef.current,
          start: "top top",
          end: () => `+=${window.innerHeight * (STAGES.length - 1)}`,
          pin: true,
          scrub: 0.6,
          onUpdate: (self) => {
            const idx = Math.min(
              STAGES.length - 1,
              Math.floor(self.progress * STAGES.length)
            );
            setActive(idx);
          },
        });
        cleanup = () => st.kill();
      }, wrapRef);

      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <section className="hairline-t">
      {pinned && (
        <div ref={wrapRef} className="relative h-screen flex items-center overflow-hidden">
          <Container className="w-full">
            <p className="font-mono-label text-ink-faint mb-10">The Growth Engine</p>

            <div className="flex items-baseline gap-6 mb-14">
              <span className="font-mono-label text-gold tabular">
                {String(active + 1).padStart(2, "0")}
              </span>
              <h2 className="text-[44px] sm:text-[64px] lg:text-[80px] leading-none">
                {STAGES[active]}
              </h2>
            </div>

            {/* progress rail */}
            <div className="flex gap-2 mb-14 max-w-xl">
              {STAGES.map((s, i) => (
                <div key={s} className="flex-1">
                  <div className="h-px bg-line-strong relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gold transition-all duration-500 ease-out"
                      style={{ width: i <= active ? "100%" : "0%" }}
                    />
                  </div>
                  <span className="font-mono-label text-ink-faint mt-3 block">{s}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {DISCIPLINES.map((d) => (
                <span key={d} className="font-mono-label text-ink-dim px-4 py-2 border border-line">
                  {d}
                </span>
              ))}
            </div>
          </Container>
        </div>
      )}

      {/* Non-pinned fallback list, shown only when reduced motion disables the pin */}
      {!pinned && (
        <Container className="pb-28">
          <ul className="flex flex-col">
            {STAGES.map((s, i) => (
              <li key={s} className="hairline-t py-10">
                <span className="font-mono-label text-gold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-[36px] mt-4">{s}</h3>
                <div className="flex flex-wrap gap-3 mt-6">
                  {DISCIPLINES.map((d) => (
                    <span key={d} className="font-mono-label text-ink-dim px-4 py-2 border border-line">
                      {d}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </section>
  );
}
