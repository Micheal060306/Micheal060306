"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { MagneticLink } from "@/components/ui/MagneticLink";
import { primaryNav, serviceCategories, services } from "@/lib/nav-data";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close any open menus when the route changes. Adjusted during render
  // (React's documented pattern for "reset state when a prop changes")
  // rather than in an effect, so it can't cascade an extra render.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMegaOpen(false);
    setMobileOpen(false);
  }

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMegaOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openMega() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(true);
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setMegaOpen(false), 140);
  }

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
          scrolled || megaOpen ? "bg-void hairline-b" : "bg-transparent"
        }`}
      >
        <div className="container-max flex items-center justify-between h-[76px]">
          <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="Zeralytics home">
            <Logo className="w-7 h-7" />
            <span className="font-mono-label text-[13px] tracking-[0.1em]">ZERALYTICS</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-10" aria-label="Primary" onMouseLeave={scheduleClose}>
            {primaryNav.map((item) =>
              item.label === "Services" ? (
                <button
                  key={item.href}
                  className="text-[14px] text-ink-dim hover:text-ink transition-colors duration-200 flex items-center gap-1.5"
                  onMouseEnter={openMega}
                  onFocus={openMega}
                  onClick={() => setMegaOpen((v) => !v)}
                  aria-expanded={megaOpen}
                  aria-haspopup="true"
                >
                  {item.label}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className={`w-3 h-3 transition-transform duration-300 ${megaOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setMegaOpen(false)}
                  className={`text-[14px] transition-colors duration-200 ${
                    pathname === item.href ? "text-ink" : "text-ink-dim hover:text-ink"
                  }`}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="flex items-center gap-6">
            <div className="hidden lg:block">
              <MagneticLink href="/contact" variant="text">
                Let&rsquo;s Talk
              </MagneticLink>
            </div>
            <button
              className="lg:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px]"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <span className="w-5 h-px bg-ink" />
              <span className="w-5 h-px bg-ink" />
            </button>
          </div>
        </div>

        {/* Services mega menu */}
        <AnimatePresence>
          {megaOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block hairline-t bg-void"
              onMouseEnter={openMega}
              onMouseLeave={scheduleClose}
            >
              <div className="container-max py-14 grid grid-cols-3 gap-16">
                {serviceCategories.map((cat) => (
                  <div key={cat}>
                    <p className="font-mono-label text-ink-faint mb-6">{cat}</p>
                    <ul className="flex flex-col gap-6">
                      {services
                        .filter((s) => s.category === cat)
                        .map((s, i) => (
                          <li key={s.slug}>
                            {s.built ? (
                              <Link href={`/services/${s.slug}`} className="group block">
                                <div className="flex items-baseline gap-3">
                                  <span className="font-mono-label text-ink-faint">
                                    {String(i + 1).padStart(2, "0")}
                                  </span>
                                  <span className="text-[17px] group-hover:text-gold transition-colors duration-200">
                                    {s.name}
                                  </span>
                                </div>
                                <p className="text-[13px] text-ink-faint mt-1.5 ml-[30px] max-w-[32ch]">
                                  {s.description}
                                </p>
                              </Link>
                            ) : (
                              <div className="opacity-45">
                                <div className="flex items-baseline gap-3">
                                  <span className="font-mono-label text-ink-faint">
                                    {String(i + 1).padStart(2, "0")}
                                  </span>
                                  <span className="text-[17px]">{s.name}</span>
                                  <span className="font-mono-label text-ink-faint">Soon</span>
                                </div>
                                <p className="text-[13px] text-ink-faint mt-1.5 ml-[30px] max-w-[32ch]">
                                  {s.description}
                                </p>
                              </div>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="container-max pb-10">
                <Link href="/services" className="font-mono-label text-ink-dim hover:text-gold transition-colors duration-200">
                  View all services →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile full-screen nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-void lg:hidden flex flex-col"
          >
            <div className="container-max w-full flex items-center justify-between h-[76px] shrink-0">
              <Link href="/" className="flex items-center gap-3" aria-label="Zeralytics home">
                <Logo className="w-7 h-7" />
                <span className="font-mono-label text-[13px]">ZERALYTICS</span>
              </Link>
              <button
                className="w-9 h-9 relative"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <span className="absolute inset-0 m-auto w-5 h-px bg-ink rotate-45" />
                <span className="absolute inset-0 m-auto w-5 h-px bg-ink -rotate-45" />
              </button>
            </div>

            <nav className="container-max w-full flex flex-col gap-1 mt-8 overflow-y-auto" aria-label="Mobile primary">
              {primaryNav.map((item, i) => (
                <MobileNavRow key={item.href} item={item} index={i} pathname={pathname} />
              ))}
            </nav>

            <div className="container-max w-full mt-auto mb-10 pt-8 hairline-t">
              <MagneticLink href="/contact" variant="solid" className="w-full justify-center">
                Let&rsquo;s Talk
              </MagneticLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MobileNavRow({
  item,
  index,
  pathname,
}: {
  item: { label: string; href: string };
  index: number;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const isServices = item.label === "Services";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.06 * index, ease: [0.16, 1, 0.3, 1] }}
      className="hairline-b"
    >
      {isServices ? (
        <button
          className="w-full flex items-center justify-between py-5 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="text-[28px] font-medium tracking-tight">{item.label}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`w-4 h-4 transition-transform duration-300 ${open ? "rotate-45" : ""}`}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : (
        <Link
          href={item.href}
          className="block py-5 text-[28px] font-medium tracking-tight"
          aria-current={pathname === item.href ? "page" : undefined}
        >
          {item.label}
        </Link>
      )}
      <AnimatePresence>
        {isServices && open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden pb-4"
          >
            {services.map((s) => (
              <li key={s.slug} className="py-2.5">
                {s.built ? (
                  <Link href={`/services/${s.slug}`} className="text-[15px] text-ink-dim">
                    {s.name}
                  </Link>
                ) : (
                  <span className="text-[15px] text-ink-faint opacity-50">{s.name} · Soon</span>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
