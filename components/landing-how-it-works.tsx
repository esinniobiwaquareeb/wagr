"use client";

import { UserPlus, Target, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: "1",
    icon: UserPlus,
    title: "Sign Up",
    description: "Create your account in seconds. No credit card required.",
  },
  {
    number: "2",
    icon: Target,
    title: "Choose Your Wager",
    description: "Browse active wagers or create your own. Pick your side.",
  },
  {
    number: "3",
    icon: TrendingUp,
    title: "Place Your Wager",
    description: "Wager on the outcome you believe in. Watch odds update in real-time.",
  },
  {
    number: "4",
    icon: Wallet,
    title: "Win & Withdraw",
    description: "Get paid instantly when you win. Withdraw anytime.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
            How It Works
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Get started in four simple steps. No complexity, just wagering.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-10 sm:mb-12">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl sm:text-2xl font-bold mb-3 sm:mb-4 shadow-lg">
                  {step.number}
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <step.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">{step.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed px-2">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center px-4">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto text-sm sm:text-base md:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <Link href="/wagers">Start Wagering Now</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
