import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { MagneticLink } from "@/components/ui/MagneticLink";

export function FinalCTA() {
  return (
    <section className="hairline-t py-32 sm:py-40 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(var(--line-strong) 1px, transparent 1px), linear-gradient(90deg, var(--line-strong) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <Container className="relative">
        <Reveal>
          <h2 className="text-[38px] sm:text-[56px] lg:text-[68px] leading-[1.03] max-w-3xl">
            Ready to turn attention into revenue?
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="flex flex-wrap items-center gap-5 mt-12">
            <MagneticLink href="/contact" variant="solid">
              Start a Conversation
            </MagneticLink>
            <MagneticLink href="/work" variant="text">
              View Our Work
            </MagneticLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
