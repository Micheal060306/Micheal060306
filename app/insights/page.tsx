import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { MagneticLink } from "@/components/ui/MagneticLink";
import { InProgressNotice } from "@/components/ui/InProgressNotice";

export const metadata: Metadata = {
  title: "Insights",
  description: "Ideas on marketing, performance, SEO, AI and growth from Zeralytics.",
};

export default function InsightsPage() {
  return (
    <section className="pt-16 pb-32">
      <Container>
        <Reveal>
          <p className="font-mono-label text-ink-faint mb-8">Insights</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="text-[38px] sm:text-[56px] lg:text-[64px] leading-[1.03] max-w-3xl">
            Ideas for the growth-minded.
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="text-ink-dim text-[17px] max-w-[52ch] mt-8">
            Writing on marketing, performance, SEO, AI, technology and growth,
            published as it&rsquo;s ready.
          </p>
        </Reveal>

        <InProgressNotice>
          The first articles are being written — nothing published yet.
        </InProgressNotice>

        <Reveal delay={0.06}>
          <div className="mt-16">
            <MagneticLink href="/contact" variant="line">
              Talk About Your Growth
            </MagneticLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
