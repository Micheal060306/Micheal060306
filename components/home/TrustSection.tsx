import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/ui/Container";

/**
 * Deliberately text-only for now: the brief is explicit that client logos
 * and stats must be real, verified assets, never invented. Swap the note
 * below for an actual logo strip once client names/marks are supplied.
 */
export function TrustSection() {
  return (
    <section className="hairline-t py-24 sm:py-28">
      <Container>
        <Reveal>
          <h2 className="text-[26px] sm:text-[34px] leading-tight max-w-2xl">
            Built for brands that want more than visibility.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="font-mono-label text-ink-faint mt-6">Client roster available on request</p>
        </Reveal>
      </Container>
    </section>
  );
}
