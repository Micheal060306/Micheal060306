"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const items = [
  {
    slug: "performance-marketing",
    name: "Performance Marketing",
    detail: "Meta, Google and retargeting systems built around a real conversion event.",
    built: true,
  },
  {
    slug: "social-media-marketing",
    name: "Social & Content",
    detail: "Platform-native strategy, content and community growth.",
    built: false,
  },
  {
    slug: "web-development",
    name: "Digital Experiences",
    detail: "Websites and product interfaces engineered to convert.",
    built: false,
  },
  {
    slug: "seo",
    name: "SEO & Organic Growth",
    detail: "Technical, content and authority work that compounds over time.",
    built: false,
  },
  {
    slug: "lead-generation",
    name: "Lead Generation",
    detail: "Full-funnel systems from traffic to qualified pipeline.",
    built: false,
  },
  {
    slug: "influencer-marketing",
    name: "Influencer Marketing",
    detail: "Creator partnerships matched to real audience intent.",
    built: false,
  },
];

export function ServicesPreview() {
  const [active, setActive] = useState(0);

  return (
    <section className="hairline-t py-28 sm:py-36">
      <Container>
        <Reveal>
          <p className="font-mono-label text-ink-faint mb-4">What We Do</p>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="text-[32px] sm:text-[44px] max-w-2xl mb-16">
            One team. Every discipline your growth engine needs.
          </h2>
        </Reveal>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
          <ul className="lg:col-span-7" onMouseLeave={() => {}}>
            {items.map((item, i) => {
              const isActive = active === i;
              const body = (
                <div
                  className="hairline-t py-7 flex items-baseline justify-between group cursor-pointer"
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="flex items-baseline gap-6">
                    <span className="font-mono-label text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span
                      className={`text-[24px] sm:text-[30px] transition-colors duration-300 ${
                        isActive ? "text-gold" : "text-ink"
                      }`}
                    >
                      {item.name}
                    </span>
                  </span>
                  {!item.built && (
                    <span className="font-mono-label text-ink-faint hidden sm:inline">Soon</span>
                  )}
                  {item.built && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                        isActive ? "translate-x-1 text-gold" : "text-ink-faint"
                      }`}
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                </div>
              );
              return (
                <li key={item.slug} className={i === items.length - 1 ? "hairline-b" : ""}>
                  {item.built ? <Link href={`/services/${item.slug}`}>{body}</Link> : body}
                </li>
              );
            })}
          </ul>

          <div className="lg:col-span-5 relative min-h-[220px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="border border-line-strong p-8 h-full flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono-label text-gold">
                    {String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                  </span>
                  <p className="text-[18px] mt-6 leading-relaxed">{items[active].detail}</p>
                </div>
                <MiniSparkline seed={active} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </section>
  );
}

function MiniSparkline({ seed }: { seed: number }) {
  const points = Array.from({ length: 14 }, (_, i) => {
    const base = Math.sin(i * 0.6 + seed * 1.7) * 0.5 + 0.5;
    return 12 + base * 40 + seed * 2;
  });
  const max = Math.max(...points);
  const w = 220;
  const h = 60;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${i * step},${h - (p / max) * h}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 mt-8" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--gold)" strokeWidth="1.5" />
    </svg>
  );
}
