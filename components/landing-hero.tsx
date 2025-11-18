"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, Users, Shield, Zap, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative min-h-[85vh] sm:min-h-screen flex items-center justify-center overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/30" />
      
      {/* Minimal grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-24 lg:py-32">
        <div className="text-center">
          {/* Main heading - Clean and bold */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight mb-4 sm:mb-6 leading-tight">
            <span className="block">Wager on</span>
            <span className="block bg-gradient-to-r from-foreground via-foreground/90 to-foreground bg-clip-text text-transparent">
              What Matters
            </span>
          </h1>

          {/* Subheading - Clear and concise */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
            Create wagers, join the action, and turn your predictions into wins.
            <br className="hidden sm:block" />
            <span className="text-sm sm:text-base md:text-lg">Simple. Fast. Fair.</span>
          </p>

          {/* CTA Buttons - Clean and prominent */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 px-4">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto text-sm sm:text-base md:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <Link href="/wagers" className="flex items-center justify-center">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto text-sm sm:text-base md:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-lg font-semibold border-2"
            >
              <Link href="/wagers">Browse Wagers</Link>
            </Button>
          </div>

          {/* Stats - Clean grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 max-w-3xl mx-auto px-2">
            {[
              { icon: Users, value: "10K+", label: "Active Users" },
              { icon: TrendingUp, value: "50K+", label: "Wagers" },
              { icon: Trophy, value: "₦5M+", label: "Paid Out" },
              { icon: Shield, value: "100%", label: "Secure" },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-3 sm:p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors"
              >
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary mb-1.5 sm:mb-2" />
                <div className="text-xl sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1">{stat.value}</div>
                <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground text-center leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
