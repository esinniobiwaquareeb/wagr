"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-28 bg-muted/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
          Ready to Start?
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
          Join thousands of users turning their predictions into profits.
          Create wagers, wager on outcomes, and win real money.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto text-sm sm:text-base md:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
              <Link href="/wagers" className="flex items-center justify-center">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full sm:w-auto text-sm sm:text-base md:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-lg font-semibold border-2"
          >
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-4 sm:mt-6 px-4">
          No credit card required • Instant signup • Secure & transparent
        </p>
      </div>
    </section>
  );
}
