import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { MagneticLink } from "@/components/ui/MagneticLink";

export function FeaturedWork() {
  return (
    <section className="hairline-t py-28 sm:py-36">
      <Container>
        <div className="flex items-end justify-between mb-16 flex-wrap gap-6">
          <Reveal>
            <h2 className="text-[32px] sm:text-[44px] max-w-xl">Work that speaks for itself.</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <MagneticLink href="/work" variant="text">
              All work
            </MagneticLink>
          </Reveal>
        </div>

        <Reveal>
          <Link
            href="/work/sample-project"
            className="group block hairline-t hairline-b py-10 grid sm:grid-cols-12 gap-8 items-baseline"
          >
            <span className="sm:col-span-2 font-mono-label text-ink-faint">01</span>
            <span className="sm:col-span-6 text-[26px] sm:text-[34px] group-hover:text-gold transition-colors duration-300">
              Case study template
            </span>
            <span className="sm:col-span-3 text-ink-dim text-[14px]">
              A sample structure for how projects will be presented once real work is added.
            </span>
            <span className="sm:col-span-1 justify-self-end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-ink-faint group-hover:text-gold group-hover:translate-x-1 transition-all duration-300">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="hairline-b py-10 grid sm:grid-cols-12 gap-8 items-baseline opacity-40">
            <span className="sm:col-span-2 font-mono-label text-ink-faint">02</span>
            <span className="sm:col-span-6 text-[26px] sm:text-[34px]">More work</span>
            <span className="sm:col-span-4 font-mono-label text-ink-faint">Publishing soon</span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
