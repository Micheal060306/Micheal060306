export type CaseStudy = {
  slug: string;
  title: string;
  isTemplate: boolean;
  industry: string;
  services: string[];
  challenge: string;
  approach: string;
  execution: string;
  result: string;
  learnings: string;
};

/**
 * Exactly one entry exists so far, and it is explicitly a template rather
 * than a real client result — the brief is strict that case studies,
 * results and client names must never be invented. Bracketed fields mark
 * where real project detail replaces the placeholder.
 */
export const caseStudies: CaseStudy[] = [
  {
    slug: "sample-project",
    title: "Case study template",
    isTemplate: true,
    industry: "[Industry]",
    services: ["Performance Marketing", "Web Development"],
    challenge:
      "[What the client's situation was before Zeralytics got involved — the specific business problem, not a generic statement.]",
    approach:
      "[The strategy Zeralytics proposed and why, tied to the challenge above.]",
    execution:
      "[What was actually built and shipped — channels, creative, technology, timeline.]",
    result:
      "[Verified, specific outcomes only. No figure goes here until it can be checked against a real report.]",
    learnings:
      "[What this project taught the team that changes how the next one is run.]",
  },
];

export function getCaseStudy(slug: string) {
  return caseStudies.find((c) => c.slug === slug);
}
