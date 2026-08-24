import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <section className="pt-16 pb-32">
      <Container>
        <Reveal>
          <h1 className="text-[32px] sm:text-[44px] max-w-2xl">Privacy Policy</h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="text-ink-dim text-[16px] max-w-[56ch] mt-8">
            The full policy is being finalized. For questions about how Zeralytics
            handles your data in the meantime, email{" "}
            <a href="mailto:info@zeralytics.in" className="text-gold">
              info@zeralytics.in
            </a>
            .
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
