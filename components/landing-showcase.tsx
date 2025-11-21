"use client";

import { TrendingUp, Users, Clock, Trophy } from "lucide-react";

export function LandingShowcase() {
  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-32 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 3px 3px, currentColor 1px, transparent 0)`,
          backgroundSize: '60px 60px',
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            Trade on Hot Topics and Trending Headlines
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto px-2 font-medium">
            Don't just follow the news—trade on it. Every event, every outcome, every headline is a live market waiting for your prediction.
          </p>
        </div>

        {/* Visual showcase grid */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 mb-12">
          {/* Live Market Example */}
          <div className="relative p-6 sm:p-8 rounded-3xl bg-card border-2 border-border hover:border-primary/50 transition-all duration-300 hover:shadow-2xl overflow-hidden group">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">LIVE MARKET</span>
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold mb-3">Will Nigeria win the AFCON?</h3>
              
              {/* Market visualization */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="font-semibold">YES</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '65%' }} />
                    </div>
                    <span className="text-sm font-bold text-primary">65%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                  <span className="font-semibold">NO</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-muted-foreground/50 rounded-full" style={{ width: '35%' }} />
                    </div>
                    <span className="text-sm font-bold">35%</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>1.2K wagers</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>2 days left</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trending Market Example */}
          <div className="relative p-6 sm:p-8 rounded-3xl bg-card border-2 border-border hover:border-primary/50 transition-all duration-300 hover:shadow-2xl overflow-hidden group">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">TRENDING</span>
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold mb-3">Bitcoin hits $100K by end of 2025?</h3>
              
              {/* Market visualization */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <span className="font-semibold">YES</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: '72%' }} />
                    </div>
                    <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">72%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                  <span className="font-semibold">NO</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-muted-foreground/50 rounded-full" style={{ width: '28%' }} />
                    </div>
                    <span className="text-sm font-bold">28%</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>3.5K wagers</span>
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  <span>₦2.5M pool</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Market categories visual */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {[
            { name: "Sports", count: "12K+", icon: "⚽" },
            { name: "Politics", count: "8K+", icon: "🏛️" },
            { name: "Entertainment", count: "15K+", icon: "🎬" },
            { name: "Crypto", count: "20K+", icon: "₿" },
          ].map((category, i) => (
            <div
              key={i}
              className="p-4 sm:p-6 rounded-2xl bg-card border-2 border-border hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-lg text-center group"
            >
              <div className="text-3xl sm:text-4xl mb-2 group-hover:scale-110 transition-transform duration-300">
                {category.icon}
              </div>
              <div className="text-sm sm:text-base font-semibold mb-1">{category.name}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">{category.count} markets</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

