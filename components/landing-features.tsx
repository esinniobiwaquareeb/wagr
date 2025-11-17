"use client";

import { TrendingUp, Users, Zap, Shield, DollarSign, Clock } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Real-Time Markets",
    description: "Wager on live events as they unfold. Sports, politics, entertainment, and more.",
  },
  {
    icon: Users,
    title: "Social Wagering",
    description: "Create your own wagers and challenge friends. The community decides the outcome.",
  },
  {
    icon: Zap,
    title: "Instant Payouts",
    description: "Get your winnings fast. Secure withdrawals directly to your bank account.",
  },
  {
    icon: Shield,
    title: "Secure & Transparent",
    description: "Full transparency on all wagers and outcomes. Your funds are safe with us.",
  },
  {
    icon: DollarSign,
    title: "Fair Odds",
    description: "Dynamic odds based on real wagering activity. Always fair, always transparent.",
  },
  {
    icon: Clock,
    title: "24/7 Available",
    description: "Wager anytime, anywhere. Mobile-optimized for wagering on the go.",
  },
];

export function LandingFeatures() {
  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Why Choose wagr
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A modern wagering platform built for simplicity and fairness.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
