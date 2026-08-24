import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { MagneticLink } from "@/components/ui/MagneticLink";
import { ServiceDirectory } from "@/components/services/ServiceDirectory";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Performance marketing, SEO, lead generation, creative, content, video, web development and influencer marketing under one accountable team.",
};

export default function ServicesPage() {
  return (
    <>
      <section className="pt-16 pb-24 sm:pb-32">
        <Container>
          <Reveal>
            <p className="font-mono-label text-ink-faint mb-8">Services</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="text-[38px] sm:text-[56px] lg:text-[68px] leading-[1.03] max-w-3xl">
              Everything your growth engine needs.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="text-ink-dim text-[17px] max-w-[52ch] mt-8">
              Eight disciplines, one accountable team. Hover a service to preview it,
              or open the ones already live below.
            </p>
          </Reveal>
        </Container>
      </section>

      <section className="hairline-t py-24 sm:py-28">
        <Container>
          <ServiceDirectory />
        </Container>
      </section>

      <section className="hairline-t py-28 sm:py-32">
        <Container>
          <Reveal>
            <h2 className="text-[32px] sm:text-[44px] max-w-xl mb-10">
              Not sure which service fits?
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <MagneticLink href="/contact" variant="solid">
              Find Your Growth Engine
            </MagneticLink>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
