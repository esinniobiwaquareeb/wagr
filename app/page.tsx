"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { LandingHero } from "@/components/landing-hero";
import { LandingFeatures } from "@/components/landing-features";
import { LandingHowItWorks } from "@/components/landing-how-it-works";
import { LandingCTA } from "@/components/landing-cta";
import { useRouter } from "next/navigation";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Check if user is authenticated
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setCheckingAuth(false);
      
      // Redirect authenticated users to wagers page
      if (user) {
        router.push("/wagers");
      }
    };
    checkUser();
  }, [supabase, router]);

  // Show loading spinner while checking auth
  if (checkingAuth) {
    return (
      <main className="flex-1">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </main>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <main className="flex-1">
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingCTA />
    </main>
  );
}
