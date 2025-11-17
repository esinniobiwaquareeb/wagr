"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="py-20 md:py-28 bg-muted/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
          Ready to Start?
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Join thousands of users turning their predictions into profits.
          Create wagers, wager on outcomes, and win real money.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="text-base md:text-lg px-8 py-6 h-auto rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <Link href="/create">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="text-base md:text-lg px-8 py-6 h-auto rounded-lg font-semibold border-2"
          >
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-6">
          No credit card required • Instant signup • Secure & transparent
        </p>
      </div>
    </section>
  );
}
