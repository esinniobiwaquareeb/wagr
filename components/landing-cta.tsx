"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Shield, Zap, CheckCircle2 } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-gradient-to-br from-primary/10 via-background to-primary/5 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 3px 3px, currentColor 1px, transparent 0)`,
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 sm:mb-8">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Join the Movement</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
          Your Knowledge Should Pay
        </h2>
        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-4 sm:mb-6 max-w-3xl mx-auto px-2 font-medium">
          You're early. Join thousands turning their insights and hot takes into wins.
        </p>
        <p className="text-base sm:text-lg text-muted-foreground/80 mb-10 sm:mb-12 max-w-2xl mx-auto px-2">
          Don't be sidelined—turn your predictions into profit.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 mb-10 sm:mb-12 px-4">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto text-base sm:text-lg md:text-xl px-8 sm:px-10 py-6 sm:py-7 h-auto rounded-xl font-bold shadow-2xl hover:shadow-primary/25 hover:scale-105 transition-all duration-200 bg-gradient-to-r from-primary to-primary/90"
          >
            <Link href="/wagers" className="flex items-center justify-center gap-2">
              Get Started Free
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full sm:w-auto text-base sm:text-lg md:text-xl px-8 sm:px-10 py-6 sm:py-7 h-auto rounded-xl font-bold border-2 hover:bg-primary/5 hover:scale-105 transition-all duration-200"
          >
            <Link href="/about">Learn More</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm sm:text-base text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Instant signup</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <span>Secure & transparent</span>
          </div>
        </div>
      </div>
    </section>
  );
}
