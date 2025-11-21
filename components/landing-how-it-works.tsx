"use client";

import { UserPlus, Target, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HowItWorksIllustration } from "./how-it-works-illustration";

const steps = [
  {
    number: "1",
    icon: UserPlus,
    title: "Sign Up Free",
    description: "Create your account in seconds. No credit card required. Just your email and you're ready to go.",
    color: "from-blue-500 to-blue-600",
  },
  {
    number: "2",
    icon: Wallet,
    title: "Fund Your Wallet",
    description: "Add funds easily with Naira. Secure payment powered by Paystack. Takes less than a minute.",
    color: "from-green-500 to-emerald-600",
  },
  {
    number: "3",
    icon: Target,
    title: "Pick Your Side",
    description: "Browse active wagers or create your own. Choose Yes or No—confident about the future? Buy shares.",
    color: "from-purple-500 to-purple-600",
  },
  {
    number: "4",
    icon: TrendingUp,
    title: "Buy Low, Sell High",
    description: "Buy shares at low prices, sell when prices go up. Or hold until the event ends and get your payout.",
    color: "from-yellow-500 to-orange-500",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(45deg, currentColor 1px, transparent 1px), linear-gradient(-45deg, currentColor 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            How It Works
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto px-2 font-medium">
            You're one step away from cashing in on your knowledge.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-12 sm:mb-16">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line (hidden on mobile, visible on desktop) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent -translate-x-1/2" />
              )}
              
              <div className="flex flex-col items-center text-center h-full">
                {/* Illustration */}
                <div className="mb-4 sm:mb-6 h-32 sm:h-40 w-full flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                  <HowItWorksIllustration step={parseInt(step.number) as 1 | 2 | 3 | 4} className="w-full h-full text-primary" />
                </div>
                
                {/* Number badge */}
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${step.color} text-white flex items-center justify-center text-2xl sm:text-3xl font-bold mb-4 sm:mb-5 shadow-xl group-hover:scale-110 transition-transform relative z-10`}>
                  {step.number}
                </div>
                
                {/* Icon */}
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br ${step.color} opacity-10 flex items-center justify-center mb-4 sm:mb-5`}>
                  <step.icon className={`h-7 w-7 sm:h-8 sm:w-8 text-foreground`} />
                </div>
                
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3">{step.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed px-2">
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
            className="w-full sm:w-auto text-base sm:text-lg md:text-xl px-8 sm:px-10 py-6 sm:py-7 h-auto rounded-xl font-bold shadow-2xl hover:shadow-primary/25 hover:scale-105 transition-all duration-200 bg-gradient-to-r from-primary to-primary/90"
          >
            <Link href="/wagers" className="flex items-center justify-center gap-2">
              Start Wagering Now
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
