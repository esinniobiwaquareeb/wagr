"use client";

import { Wallet, Target, TrendingUp, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Wallet,
    title: "Fund Your Wallet",
    description: "Add funds securely using Paystack. Your wallet balance is always visible in the navigation.",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    icon: Target,
    title: "Choose Your Wager",
    description: "Browse active wagers or create your own. Pick Yes or No based on your prediction.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: TrendingUp,
    title: "Watch It Unfold",
    description: "Monitor your wagers in real-time. See odds change as more people join.",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  {
    icon: CheckCircle2,
    title: "Get Paid",
    description: "When the wager resolves, winners automatically receive their payout to their wallet.",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-12 md:py-16 border-t border-border/50 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">How It Works</h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Simple, transparent wagering. Here's everything you need to know.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex flex-col items-start p-4 md:p-5 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-all"
            >
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg ${step.bgColor} flex items-center justify-center mb-3 md:mb-4`}>
                <step.icon className={`h-5 w-5 md:h-6 md:w-6 ${step.color}`} />
              </div>
              <h3 className="text-base md:text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

