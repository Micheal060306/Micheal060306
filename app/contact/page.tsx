import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Tell Zeralytics what you're building, where you're stuck, and where you want to go.",
};

export default function ContactPage() {
  return (
    <section className="pt-16 pb-32">
      <Container>
        <Reveal>
          <p className="font-mono-label text-ink-faint mb-8">Contact</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="text-[36px] sm:text-[52px] lg:text-[60px] leading-[1.05] max-w-2xl">
            Let&rsquo;s build something that performs.
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="text-ink-dim text-[17px] max-w-[54ch] mt-7">
            Tell us what you&rsquo;re building, where you&rsquo;re stuck, and where you want to go.
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-12 gap-16 mt-20">
          <div className="lg:col-span-4">
            <Reveal>
              <dl className="flex flex-col gap-10">
                <div>
                  <dt className="font-mono-label text-ink-faint mb-2">Office</dt>
                  <dd className="text-[16px] text-ink-dim leading-relaxed">
                    No. 1434, TP Chatram, Shenoy Nagar,
                    <br />
                    Chennai, 600030
                  </dd>
                </div>
                <div>
                  <dt className="font-mono-label text-ink-faint mb-2">Phone</dt>
                  <dd>
                    <a href="tel:+918939572391" className="text-[16px] hover:text-gold transition-colors duration-200">
                      +91 89395 72391
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="font-mono-label text-ink-faint mb-2">Email</dt>
                  <dd>
                    <a href="mailto:info@zeralytics.in" className="text-[16px] hover:text-gold transition-colors duration-200">
                      info@zeralytics.in
                    </a>
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <Reveal delay={0.1}>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
