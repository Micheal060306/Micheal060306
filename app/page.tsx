import { Hero } from "@/components/home/Hero";
import { TrustSection } from "@/components/home/TrustSection";
import { Positioning } from "@/components/home/Positioning";
import { ServicesPreview } from "@/components/home/ServicesPreview";
import { GrowthEngine } from "@/components/home/GrowthEngine";
import { FeaturedWork } from "@/components/home/FeaturedWork";
import { FinalCTA } from "@/components/home/FinalCTA";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustSection />
      <Positioning />
      <ServicesPreview />
      <GrowthEngine />
      <FeaturedWork />
      <FinalCTA />
    </>
  );
}
