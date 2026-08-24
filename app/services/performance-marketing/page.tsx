import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { MagneticLink } from "@/components/ui/MagneticLink";
import { CampaignDashboard } from "@/components/services/CampaignDashboard";

export const metadata: Metadata = {
  title: "Performance Marketing",
  description:
    "Paid media systems built around measurable growth — Meta Ads, Google Ads, retargeting, creative testing and conversion optimization.",
};

const capabilities = [
  "Paid Media Strategy",
  "Meta Ads",
  "Google Ads",
  "Retargeting",
  "Creative Testing",
  "Funnel Strategy",
  "Conversion Optimization",
  "Analytics",
  "Reporting",
];

export default function PerformanceMarketingPage() {
  return (
    <>
      <section className="pt-16 pb-20 sm:pb-28">
        <Container>
          <Reveal>
            <p className="font-mono-label text-ink-faint mb-8">Services / Performance Marketing</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="text-[38px] sm:text-[56px] lg:text-[68px] leading-[1.03] max-w-3xl">
              Performance without guesswork.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="text-ink-dim text-[17px] max-w-[52ch] mt-8">
              Every rupee of spend is tied to a conversion event we can point to. No
              vanity metrics, no black-box reporting.
            </p>
          </Reveal>
        </Container>
      </section>

      <section className="hairline-t py-24 sm:py-28">
        <Container>
          <Reveal>
            <p className="font-mono-label text-ink-faint mb-10">What&rsquo;s included</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-x-16">
            {capabilities.map((c, i) => (
              <Reveal key={c} delay={Math.min(i, 5) * 0.04}>
                <div className="hairline-t py-6 flex items-baseline gap-6">
                  <span className="font-mono-label text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[19px]">{c}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="hairline-t py-24 sm:py-28">
        <Container>
          <Reveal>
            <h2 className="text-[28px] sm:text-[36px] max-w-xl mb-10">
              Reporting you can actually read.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <CampaignDashboard />
          </Reveal>
        </Container>
      </section>

      <section className="hairline-t py-28 sm:py-32">
        <Container>
          <Reveal>
            <h2 className="text-[32px] sm:text-[44px] max-w-xl mb-10">
              Build your performance engine.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <MagneticLink href="/contact" variant="solid">
              Scale Your Campaigns
            </MagneticLink>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
