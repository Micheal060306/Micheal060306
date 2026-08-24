import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { MagneticLink } from "@/components/ui/MagneticLink";
import { caseStudies, getCaseStudy } from "@/lib/work-data";

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return {};
  return { title: study.title, description: study.challenge };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) notFound();

  const fields: [string, string][] = [
    ["Challenge", study.challenge],
    ["Approach", study.approach],
    ["Execution", study.execution],
    ["Result", study.result],
    ["Key Learnings", study.learnings],
  ];

  return (
    <>
      <section className="pt-16 pb-16">
        <Container>
          {study.isTemplate && (
            <Reveal>
              <p className="font-mono-label text-gold mb-6">Template — not a client result</p>
            </Reveal>
          )}
          <Reveal delay={0.05}>
            <p className="font-mono-label text-ink-faint mb-8">Work / {study.title}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="text-[36px] sm:text-[54px] lg:text-[64px] leading-[1.03] max-w-3xl">
              {study.title}
            </h1>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="grid sm:grid-cols-3 gap-8 mt-14 max-w-2xl">
              <div>
                <p className="font-mono-label text-ink-faint mb-2">Client</p>
                <p className="text-[15px] text-ink-dim">[Client Name]</p>
              </div>
              <div>
                <p className="font-mono-label text-ink-faint mb-2">Industry</p>
                <p className="text-[15px] text-ink-dim">{study.industry}</p>
              </div>
              <div>
                <p className="font-mono-label text-ink-faint mb-2">Services</p>
                <p className="text-[15px] text-ink-dim">{study.services.join(", ")}</p>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* visual-first placeholder */}
      <Reveal>
        <Container>
          <div
            className="hairline-t hairline-b h-[46vh] sm:h-[58vh] flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="font-mono-label text-ink-faint">Project gallery — pending assets</span>
          </div>
        </Container>
      </Reveal>

      <section className="py-24 sm:py-28">
        <Container>
          <div className="max-w-2xl">
            {fields.map(([label, value], i) => (
              <Reveal key={label} delay={i * 0.05}>
                <div className="hairline-t py-9">
                  <p className="font-mono-label text-ink-faint mb-4">{label}</p>
                  <p className="text-[17px] text-ink-dim leading-relaxed">{value}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="hairline-t py-20">
        <Container className="flex flex-wrap items-center justify-between gap-8">
          <MagneticLink href="/work" variant="text">
            Next Project
          </MagneticLink>
          <MagneticLink href="/contact" variant="solid">
            Start Your Project
          </MagneticLink>
        </Container>
      </section>
    </>
  );
}
