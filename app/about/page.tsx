import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { MagneticLink } from "@/components/ui/MagneticLink";
import { InProgressNotice } from "@/components/ui/InProgressNotice";

export const metadata: Metadata = {
  title: "About",
  description: "Zeralytics is a digital growth studio built at the intersection of strategy, creative, media and technology.",
};

export default function AboutPage() {
  return (
    <section className="pt-16 pb-32">
      <Container>
        <Reveal>
          <p className="font-mono-label text-ink-faint mb-8">About</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="text-[38px] sm:text-[56px] lg:text-[64px] leading-[1.03] max-w-3xl">
            Built for growth-minded brands.
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="text-ink-dim text-[17px] max-w-[56ch] mt-8">
            Zeralytics exists because most agencies treat marketing as the finish
            line. We treat it as one input into a larger system, alongside the
            website, the product, and the numbers behind both, and we build all of
            it under one roof instead of handing it off between vendors.
          </p>
        </Reveal>

        <InProgressNotice>
          Full brand story, team and culture sections are in progress.
        </InProgressNotice>

        <Reveal delay={0.06}>
          <div className="mt-16">
            <MagneticLink href="/contact" variant="line">
              Work With Zeralytics
            </MagneticLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
