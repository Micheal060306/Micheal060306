import { Container } from "@/components/ui/Container";
import { MagneticLink } from "@/components/ui/MagneticLink";

export default function NotFound() {
  return (
    <section className="pt-16 pb-32">
      <Container>
        <p className="font-mono-label text-ink-faint mb-8">404</p>
        <h1 className="text-[38px] sm:text-[56px] max-w-2xl">This page doesn&rsquo;t exist yet.</h1>
        <p className="text-ink-dim text-[17px] max-w-[48ch] mt-8">
          It may be one of the pages still being built out, or the link may be wrong.
        </p>
        <div className="mt-12">
          <MagneticLink href="/" variant="line">
            Back to home
          </MagneticLink>
        </div>
      </Container>
    </section>
  );
}
