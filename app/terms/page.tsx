import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <section className="pt-16 pb-32">
      <Container>
        <Reveal>
          <h1 className="text-[32px] sm:text-[44px] max-w-2xl">Terms</h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="text-ink-dim text-[16px] max-w-[56ch] mt-8">
            Terms of service are being finalized. For questions in the meantime,
            email{" "}
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
