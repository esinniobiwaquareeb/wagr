"use client";

import { LandingHero } from "@/components/landing-hero";
import { LandingFeatures } from "@/components/landing-features";
import { LandingHowItWorks } from "@/components/landing-how-it-works";
import { LandingCTA } from "@/components/landing-cta";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { user, loading } = useAuth({ 
    redirectIfAuthenticated: true, 
    redirectTo: "/wagers" 
  });

  if (loading) {
    return (
      <main className="flex-1">
        <LoadingSpinner size="lg" fullScreen text="Loading..." />
      </main>
    );
  }

  return (
    <main className="flex-1">
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingCTA />
    </main>
  );
}
