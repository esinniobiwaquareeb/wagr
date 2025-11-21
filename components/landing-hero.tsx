"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, Users, Shield, Zap, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingHeroIllustration } from "./landing-hero-illustration";

export function LandingHero() {
  return (
    <section className="relative min-h-[90vh] sm:min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      
      {/* Subtle animated grid pattern */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }} />
      </div>

      {/* Floating orbs for visual interest */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-24 lg:py-32">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 sm:mb-8">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">The Future of Wagering</span>
          </div>

          {/* Main heading - More impactful */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-extrabold tracking-tight mb-6 sm:mb-8 leading-[1.1]">
            <span className="block text-foreground">Don't Just</span>
            <span className="block bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">
              Watch, Wager
            </span>
            <span className="block text-foreground">The Future</span>
          </h1>

          {/* Subheading - More engaging */}
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-muted-foreground max-w-3xl mx-auto mb-4 sm:mb-6 leading-relaxed px-2 font-medium">
            Turn your predictions into profit. Wager on sports, politics, entertainment, and anything people care about.
          </p>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-10 sm:mb-12 px-2">
            Every event is a market. Every outcome is an opportunity.
          </p>

          {/* CTA Buttons - More prominent */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 mb-16 sm:mb-20 px-4">
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
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto text-base sm:text-lg md:text-xl px-8 sm:px-10 py-6 sm:py-7 h-auto rounded-xl font-bold border-2 hover:bg-primary/5 hover:scale-105 transition-all duration-200"
            >
              <Link href="/wagers">Browse Markets</Link>
            </Button>
          </div>

          {/* Hero Illustration */}
          <LandingHeroIllustration />

          {/* Stats - Enhanced design */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 max-w-4xl mx-auto px-2 mt-12 sm:mt-16">
            {[
              { icon: Users, value: "10K+", label: "Active Traders", color: "text-blue-500" },
              { icon: TrendingUp, value: "50K+", label: "Wagers Created", color: "text-green-500" },
              { icon: Trophy, value: "₦5M+", label: "Paid Out", color: "text-yellow-500" },
              { icon: Shield, value: "100%", label: "Secure", color: "text-purple-500" },
            ].map((stat, i) => (
              <div
                key={i}
                className="group flex flex-col items-center p-5 sm:p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:bg-card transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                <div className={`mb-3 p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors`}>
                  <stat.icon className={`h-6 w-6 sm:h-7 sm:w-7 ${stat.color}`} />
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1.5 sm:mb-2 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground text-center leading-tight font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
