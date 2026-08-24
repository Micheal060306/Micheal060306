"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { serviceCategories, services } from "@/lib/nav-data";

export function ServiceDirectory() {
  const [hovered, setHovered] = useState<string | null>(null);
  const activeSlug = hovered ?? services[0].slug;
  const active = services.find((s) => s.slug === activeSlug)!;

  return (
    <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
      <div className="lg:col-span-7">
        {serviceCategories.map((cat) => (
          <div key={cat} className="mb-14 last:mb-0">
            <p className="font-mono-label text-ink-faint mb-6">{cat}</p>
            <ul>
              {services
                .filter((s) => s.category === cat)
                .map((s, i) => {
                  const row = (
                    <div
                      className="hairline-t py-6 flex items-baseline justify-between group"
                      onMouseEnter={() => setHovered(s.slug)}
                    >
                      <span className="flex items-baseline gap-6">
                        <span className="font-mono-label text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                        <span
                          className={`text-[22px] sm:text-[28px] transition-colors duration-300 ${
                            activeSlug === s.slug ? "text-gold" : "text-ink"
                          }`}
                        >
                          {s.name}
                        </span>
                      </span>
                      {s.built ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-ink-faint group-hover:text-gold group-hover:translate-x-1 transition-all duration-300">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      ) : (
                        <span className="font-mono-label text-ink-faint">Soon</span>
                      )}
                    </div>
                  );
                  return (
                    <li key={s.slug}>
                      {s.built ? <Link href={`/services/${s.slug}`}>{row}</Link> : row}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      <div className="lg:col-span-5">
        <div className="sticky top-[100px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.slug}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="border border-line-strong p-8"
            >
              <p className="font-mono-label text-gold mb-4">{active.category}</p>
              <h3 className="text-[26px] mb-4">{active.name}</h3>
              <p className="text-ink-dim text-[15px] leading-relaxed">{active.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
