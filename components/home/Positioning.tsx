import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Container";

const pillars = ["Strategy", "Creative", "Media", "Technology", "Conversion"];

export function Positioning() {
  return (
    <section className="hairline-t py-28 sm:py-36">
      <Container>
        <Reveal>
          <p className="font-mono-label text-ink-faint mb-8">Our Philosophy</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="text-[36px] sm:text-[52px] lg:text-[64px] leading-[1.04] max-w-4xl">
            Marketing is not the destination. <span className="text-ink-dim">Growth is.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mt-20 flex flex-wrap items-center gap-x-3 gap-y-6">
            {pillars.map((p, i) => (
              <span key={p} className="flex items-center gap-3">
                <span className="font-mono-label text-ink px-4 py-2 border border-line-strong">
                  {p}
                </span>
                {i < pillars.length - 1 && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-4 h-4 text-ink-faint">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </span>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
