"use client";

import { LandingHero } from "@/components/landing-hero";
import { LandingFeatures } from "@/components/landing-features";
import { LandingHowItWorks } from "@/components/landing-how-it-works";
import { LandingCTA } from "@/components/landing-cta";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingCTA />
    </div>
  );
}

