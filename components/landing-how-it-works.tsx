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
    title: "Place Your Bet",
    description: "Bet on the outcome you believe in. Watch odds update in real-time.",
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
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in four simple steps. No complexity, just betting.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mb-4 shadow-lg">
                  {step.number}
                </div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button
            asChild
            size="lg"
            className="text-base md:text-lg px-8 py-6 h-auto rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <Link href="/create">Start Betting Now</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
