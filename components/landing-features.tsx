"use client";

import { TrendingUp, Users, Zap, Shield, DollarSign, Clock, Target, BarChart3 } from "lucide-react";
import { MarketCategoryIllustration } from "./market-category-illustration";

const features = [
  {
    icon: Target,
    title: "Trade on Hot Topics",
    description: "Wager on trending events, breaking news, and everything people are talking about. Don't just follow—trade it.",
    gradient: "from-blue-500 to-blue-600",
    illustration: "sports" as const,
  },
  {
    icon: Users,
    title: "Create Your Own Markets",
    description: "Start wagers on anything you care about. Sports, politics, entertainment—if it matters, you can wager on it.",
    gradient: "from-purple-500 to-purple-600",
    illustration: "politics" as const,
  },
  {
    icon: Zap,
    title: "Instant Payouts",
    description: "Get your winnings fast. Secure withdrawals directly to your bank account in minutes, not days.",
    gradient: "from-yellow-500 to-orange-500",
    illustration: "general" as const,
  },
  {
    icon: Shield,
    title: "Transparent & Secure",
    description: "Every outcome is resolved using verifiable sources. Your funds are safe, and every transaction is transparent.",
    gradient: "from-green-500 to-emerald-600",
    illustration: "general" as const,
  },
  {
    icon: BarChart3,
    title: "Real-Time Odds",
    description: "Watch odds update in real-time as people wager. Dynamic pricing based on actual market activity.",
    gradient: "from-pink-500 to-rose-600",
    illustration: "crypto" as const,
  },
  {
    icon: Clock,
    title: "24/7 Markets",
    description: "Wager anytime, anywhere. Mobile-optimized platform for trading on the go, day or night.",
    gradient: "from-indigo-500 to-indigo-600",
    illustration: "entertainment" as const,
  },
];

export function LandingFeatures() {
  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            Markets to Wager
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto px-2 font-medium">
            The world is talking—don't just watch, wager on it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-6 sm:p-8 rounded-2xl bg-card border-2 border-border hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] overflow-hidden"
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              
              <div className="relative z-10">
                {/* Illustration */}
                <div className="mb-4 sm:mb-5 h-24 sm:h-32 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                  <MarketCategoryIllustration category={feature.illustration} className="w-full h-full text-primary" />
                </div>
                
                {/* Icon badge */}
                <div className={`absolute top-4 right-4 w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                
                <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
