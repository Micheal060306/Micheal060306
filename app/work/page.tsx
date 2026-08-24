import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { WorkGrid } from "@/components/work/WorkGrid";

export const metadata: Metadata = {
  title: "Work",
  description: "Case studies and projects from Zeralytics.",
};

export default function WorkPage() {
  return (
    <>
      <section className="pt-16 pb-20 sm:pb-28">
        <Container>
          <Reveal>
            <p className="font-mono-label text-ink-faint mb-8">Work</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="text-[38px] sm:text-[56px] lg:text-[68px] leading-[1.03] max-w-3xl">
              Work that speaks for itself.
            </h1>
          </Reveal>
        </Container>
      </section>

      <section className="hairline-t py-20 sm:py-24">
        <Container>
          <WorkGrid />
        </Container>
      </section>
    </>
  );
}
