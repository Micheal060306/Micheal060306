"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { MagneticLink } from "@/components/ui/MagneticLink";
import { GrowthFlow } from "@/components/home/GrowthFlow";

const line1 = "We turn attention".split(" ");
const line2 = "into growth.".split(" ");

export function Hero() {
  const reduced = useReducedMotion();

  return (
    <section className="pt-20 sm:pt-28 pb-16">
      <Container>
        <p className="font-mono-label text-ink-faint mb-8">Digital Growth Agency · Chennai</p>

        <h1 className="text-[13vw] sm:text-[64px] lg:text-[84px] leading-[0.98] font-medium max-w-4xl">
          <span className="block overflow-hidden">
            {line1.map((word, i) => (
              <motion.span
                key={word}
                className="inline-block mr-[0.28em]"
                initial={reduced ? undefined : { y: "110%" }}
                animate={reduced ? undefined : { y: "0%" }}
                transition={{ duration: 0.8, delay: 0.15 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                {word}
              </motion.span>
            ))}
          </span>
          <span className="block overflow-hidden text-ink-dim">
            {line2.map((word, i) => (
              <motion.span
                key={word}
                className="inline-block mr-[0.28em]"
                initial={reduced ? undefined : { y: "110%" }}
                animate={reduced ? undefined : { y: "0%" }}
                transition={{ duration: 0.8, delay: 0.32 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                {word}
              </motion.span>
            ))}
          </span>
        </h1>

        <motion.p
          initial={reduced ? undefined : { opacity: 0, y: 16 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="text-[17px] sm:text-[19px] text-ink-dim max-w-[46ch] mt-8"
        >
          Zeralytics builds performance-driven digital systems that help ambitious
          brands attract, convert and scale.
        </motion.p>

        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 16 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.68, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center gap-5 mt-11"
        >
          <MagneticLink href="/contact" variant="solid">
            Start a Growth Conversation
          </MagneticLink>
          <MagneticLink href="/work" variant="text">
            Explore Our Work
          </MagneticLink>
        </motion.div>
      </Container>

      <motion.div
        initial={reduced ? undefined : { opacity: 0 }}
        animate={reduced ? undefined : { opacity: 1 }}
        transition={{ duration: 1, delay: 0.9 }}
        className="mt-20"
      >
        <Container>
          <GrowthFlow />
        </Container>
      </motion.div>
    </section>
  );
}
