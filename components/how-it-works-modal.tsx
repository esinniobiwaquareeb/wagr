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
  BarChart3
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const coreSteps = [
  {
    icon: UserPlus,
    title: "Sign Up & Get Started",
    description: "Create your free account in seconds. Use a referral code to get bonus funds when you sign up!",
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
    title: "System-Generated Wagers",
    description: "AI-powered wagers on crypto prices, stock markets, sports events, and breaking news. Fresh markets daily!",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
  },
  {
    icon: TrendingUp,
    title: "Trending Markets",
    description: "Discover the hottest wagers based on volume, participants, and recent activity. See what everyone's wagering on!",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
  },
  {
    icon: Gift,
    title: "Referral Rewards",
    description: "Invite friends and earn rewards! Both you and your friend get bonus funds when they sign up with your code.",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/20",
  },
  {
    icon: Trophy,
    title: "Gamification",
    description: "Earn XP, unlock achievements, complete daily challenges, and maintain streaks. Level up as you wager!",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
  },
  {
    icon: Users,
    title: "Social Features",
    description: "Follow other users, see their activity, and build your network. Share your wins and achievements!",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
  },
  {
    icon: Share2,
    title: "Share & Invite",
    description: "Share wagers on social media, invite friends to join, and grow your community. Make wagering social!",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-950/20",
  },
  {
    icon: BarChart3,
    title: "Real-Time Updates",
    description: "See odds change in real-time as people join. Get instant notifications when wagers resolve or you win.",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
  },
  {
    icon: Zap,
    title: "Quick Actions",
    description: "Switch sides, leave wagers, or create markets in seconds. Everything is optimized for speed and ease.",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/20",
  },
];

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl font-bold text-center">
            How It Works
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <p className="text-sm md:text-base text-muted-foreground text-center mb-6 max-w-2xl mx-auto">
            Everything you need to know about wagering on wagered.app. From basics to advanced features.
          </p>

          <Tabs defaultValue="basics" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="basics">Getting Started</TabsTrigger>
              <TabsTrigger value="features">Features & Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {coreSteps.map((step, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-start p-4 md:p-5 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-md transition-all relative"
                  >
                    <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl ${step.bgColor} flex items-center justify-center mb-3 md:mb-4 mt-2`}>
                      <step.icon className={`h-6 w-6 md:h-7 md:w-7 ${step.color}`} />
                    </div>
                    <h3 className="text-base md:text-lg font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-start p-4 md:p-5 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl ${feature.bgColor} flex items-center justify-center mb-3 md:mb-4`}>
                      <feature.icon className={`h-6 w-6 md:h-7 md:w-7 ${feature.color}`} />
                    </div>
                    <h3 className="text-base md:text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-6 border-t border-border">
            <div className="bg-muted/50 rounded-lg p-4 md:p-6">
              <h4 className="font-semibold text-sm md:text-base mb-2">💡 Pro Tips</h4>
              <ul className="space-y-1.5 text-xs md:text-sm text-muted-foreground">
                <li>• Use referral codes when signing up to get bonus funds</li>
                <li>• Complete daily challenges to earn extra rewards</li>
                <li>• Follow trending wagers to see what's hot</li>
                <li>• Share your wagers to invite friends and grow your network</li>
                <li>• Check your achievements and level up to unlock more features</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <Button onClick={onClose} className="w-full sm:w-auto">
              Got it, let's start!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

