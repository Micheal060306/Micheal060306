"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { caseStudies } from "@/lib/work-data";

const FILTERS = ["All", "Performance", "Creative", "Web", "Social", "SEO"] as const;

function matchesFilter(services: string[], filter: (typeof FILTERS)[number]) {
  if (filter === "All") return true;
  const map: Record<string, string[]> = {
    Performance: ["Performance Marketing", "Lead Generation"],
    Creative: ["Content & Creative", "Video Production"],
    Web: ["Web Development"],
    Social: ["Social Media Marketing"],
    SEO: ["SEO"],
  };
  return services.some((s) => map[filter]?.includes(s));
}

export function WorkGrid() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const filtered = useMemo(
    () => caseStudies.filter((c) => matchesFilter(c.services, filter)),
    [filter]
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-16">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-mono-label px-4 py-2.5 border transition-colors duration-200 ${
              filter === f
                ? "border-gold text-gold"
                : "border-line text-ink-faint hover:text-ink-dim hover:border-line-strong"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-ink-faint font-mono-label py-10">
          Nothing filed under {filter} yet — more work publishing soon.
        </p>
      )}

      <ul>
        {filtered.map((c, i) => (
          <motion.li
            key={c.slug}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="hairline-t last:hairline-b"
          >
            <Link href={`/work/${c.slug}`} className="group grid sm:grid-cols-12 gap-6 items-baseline py-10">
              <span className="sm:col-span-1 font-mono-label text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="sm:col-span-6 text-[26px] sm:text-[36px] group-hover:text-gold transition-colors duration-300">
                {c.title}
              </span>
              <span className="sm:col-span-3 font-mono-label text-ink-faint">{c.industry}</span>
              <span className="sm:col-span-2 justify-self-end">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-ink-faint group-hover:text-gold group-hover:translate-x-1 transition-all duration-300">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
