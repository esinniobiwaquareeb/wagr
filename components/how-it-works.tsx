"use client";

import { 
  Wallet, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  UserPlus,
  Sparkles,
  Gift,
  Trophy,
  Users,
  Share2,
  Zap,
  BarChart3,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const coreSteps = [
  {
    icon: UserPlus,
    title: "Sign Up Free",
    description: "Create your account in seconds. Use a referral code to get bonus funds when you sign up!",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    icon: Wallet,
    title: "Fund Your Wallet",
    description: "Add funds securely using Paystack. Your wallet balance is always visible in the navigation.",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  {
    icon: Target,
    title: "Choose Your Wager",
    description: "Browse trending wagers, system-generated markets, or create your own. Pick Yes or No based on your prediction.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: TrendingUp,
    title: "Watch It Unfold",
    description: "Monitor your wagers in real-time. See odds change as more people join. Track your potential returns.",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
  },
  {
    icon: CheckCircle2,
    title: "Get Paid Automatically",
    description: "When the wager resolves, winners automatically receive their payout to their wallet. No waiting!",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
  },
];

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Markets",
    description: "System-generated wagers on crypto, stocks, sports, and news. Fresh markets daily!",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
  },
  {
    icon: TrendingUp,
    title: "Trending Wagers",
    description: "Discover the hottest wagers based on volume and activity. See what everyone's wagering on!",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
  },
  {
    icon: Gift,
    title: "Referral Rewards",
    description: "Invite friends and earn rewards! Both you and your friend get bonus funds.",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/20",
  },
  {
    icon: Trophy,
    title: "Gamification",
    description: "Earn XP, unlock achievements, complete challenges, and maintain streaks. Level up!",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
  },
  {
    icon: Users,
    title: "Social Network",
    description: "Follow users, see activity feeds, and build your network. Make wagering social!",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
  },
  {
    icon: Share2,
    title: "Share & Invite",
    description: "Share wagers on social media and invite friends. Grow your community!",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-950/20",
  },
  {
    icon: BarChart3,
    title: "Real-Time Updates",
    description: "See odds change in real-time. Get instant notifications when you win!",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
  },
  {
    icon: Zap,
    title: "Quick Actions",
    description: "Switch sides, leave wagers, or create markets in seconds. Optimized for speed!",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/20",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-12 md:py-16 lg:py-20 border-t border-border/50 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-3">How It Works</h2>
          <p className="text-sm md:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about wagering on wagered.app. From basics to advanced features.
          </p>
        </div>

        <Tabs defaultValue="basics" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8 md:mb-12">
            <TabsTrigger value="basics" className="text-sm md:text-base">Getting Started</TabsTrigger>
            <TabsTrigger value="features" className="text-sm md:text-base">Features & Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {coreSteps.map((step, index) => (
                <div
                  key={index}
                  className="flex flex-col items-start p-4 md:p-5 lg:p-6 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all relative group"
                >
                  <div className="absolute -top-2 -left-2 w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs md:text-sm font-bold shadow-lg">
                    {index + 1}
                  </div>
                  <div className={`w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-xl ${step.bgColor} flex items-center justify-center mb-3 md:mb-4 mt-2 group-hover:scale-110 transition-transform`}>
                    <step.icon className={`h-6 w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 ${step.color}`} />
                  </div>
                  <h3 className="text-base md:text-lg lg:text-xl font-semibold mb-2 md:mb-3">{step.title}</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex flex-col items-start p-4 md:p-5 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all group"
                >
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl ${feature.bgColor} flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`h-6 w-6 md:h-7 md:w-7 ${feature.color}`} />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Pro Tips Section */}
        <div className="mt-12 md:mt-16 pt-8 md:pt-12 border-t border-border/50">
          <div className="max-w-4xl mx-auto">
            <div className="bg-card border border-border/50 rounded-xl p-6 md:p-8">
              <h3 className="font-semibold text-lg md:text-xl mb-4 md:mb-6 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Pro Tips for Success
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="flex items-start gap-2">
                  <Gift className="h-4 w-4 md:h-5 md:w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm md:text-base text-muted-foreground">
                    Use referral codes when signing up to get bonus funds
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Trophy className="h-4 w-4 md:h-5 md:w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm md:text-base text-muted-foreground">
                    Complete daily challenges to earn extra rewards and XP
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm md:text-base text-muted-foreground">
                    Follow trending wagers to see what's hot and popular
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Share2 className="h-4 w-4 md:h-5 md:w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm md:text-base text-muted-foreground">
                    Share your wagers to invite friends and grow your network
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 md:mt-12 text-center">
          <Button
            asChild
            size="lg"
            className="text-base md:text-lg px-6 md:px-8 py-6 md:py-7 h-auto rounded-xl font-semibold"
          >
            <Link href="/wagers" className="flex items-center justify-center gap-2">
              Start Wagering Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

