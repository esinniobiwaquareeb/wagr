"use client";

import { LandingHero } from "@/components/landing-hero";
import { LandingFeatures } from "@/components/landing-features";
import { LandingHowItWorks } from "@/components/landing-how-it-works";
import { LandingCTA } from "@/components/landing-cta";

export default function Home() {
  // Landing page is accessible to everyone (authenticated and unauthenticated)
  // No redirect needed - users can access the landing page anytime
  
  return (
    <main className="flex-1">
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingCTA />
    </main>
  );
}
