import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { primaryNav } from "@/lib/nav-data";

export function Footer() {
  return (
    <footer className="hairline-t mt-32">
      <div className="container-max py-20 grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-5">
          <Link href="/" className="flex items-center gap-3" aria-label="Zeralytics home">
            <Logo className="w-7 h-7" />
            <span className="font-mono-label text-[13px]">ZERALYTICS</span>
          </Link>
          <p className="text-ink-dim text-[15px] mt-6 max-w-[38ch]">
            A digital growth studio in Chennai working at the intersection of strategy,
            creative, media and technology.
          </p>
        </div>

        <div className="md:col-span-2">
          <p className="font-mono-label text-ink-faint mb-5">Site</p>
          <ul className="flex flex-col gap-3">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[14px] text-ink-dim hover:text-ink transition-colors duration-200">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2">
          <p className="font-mono-label text-ink-faint mb-5">Contact</p>
          <ul className="flex flex-col gap-3">
            <li>
              <a href="tel:+918939572391" className="text-[14px] text-ink-dim hover:text-ink transition-colors duration-200">
                +91 89395 72391
              </a>
            </li>
            <li>
              <a href="mailto:info@zeralytics.in" className="text-[14px] text-ink-dim hover:text-ink transition-colors duration-200">
                info@zeralytics.in
              </a>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <p className="font-mono-label text-ink-faint mb-5">Office</p>
          <p className="text-[14px] text-ink-dim leading-relaxed">
            No. 1434, TP Chatram, Shenoy Nagar,
            <br />
            Chennai, 600030
          </p>
        </div>
      </div>

      <div className="container-max hairline-t py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="font-mono-label text-ink-faint">© {new Date().getFullYear()} Zeralytics</p>
        <div className="flex gap-6">
          <Link href="/privacy" className="font-mono-label text-ink-faint hover:text-ink-dim transition-colors duration-200">
            Privacy
          </Link>
          <Link href="/terms" className="font-mono-label text-ink-faint hover:text-ink-dim transition-colors duration-200">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
