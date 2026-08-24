"use client";

import Link from "next/link";
import { useRef, useState, MouseEvent } from "react";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "line" | "text";
  className?: string;
};

/**
 * Understated CTA: no pill, no gradient, no drop shadow. "solid" inverts to a
 * flat gold fill (the one moment of accent color); "line" is a hairline
 * rectangle; "text" is a plain animated-underline link. All three get a
 * subtle magnetic pull toward the cursor on fine-pointer devices.
 */
export function MagneticLink({ href, children, variant = "line", className = "" }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function onMove(e: MouseEvent<HTMLAnchorElement>) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      x: (e.clientX - r.left - r.width / 2) * 0.25,
      y: (e.clientY - r.top - r.height / 2) * 0.35,
    });
  }

  function onLeave() {
    setPos({ x: 0, y: 0 });
  }

  const base =
    "inline-flex items-center gap-2.5 font-mono-label transition-colors duration-200";
  const variants: Record<string, string> = {
    solid:
      "px-7 py-4 border border-gold bg-gold text-on-gold hover:bg-transparent hover:text-gold",
    line: "px-7 py-4 border border-line-strong text-ink hover:border-gold hover:text-gold",
    text: "text-ink-dim hover:text-ink group",
  };

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`${base} ${variants[variant]} ${className}`}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 220ms cubic-bezier(0.16,1,0.3,1), color 200ms, background-color 200ms, border-color 200ms",
      }}
    >
      <span>{children}</span>
      {variant === "text" && (
        <span className="relative overflow-hidden w-3 h-3 inline-block">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="w-3 h-3 transition-transform duration-300 ease-out group-hover:translate-x-1"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      )}
      {variant !== "text" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )}
    </Link>
  );
}
