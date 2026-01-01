"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Flame, Award, Star, Zap, Gift, CheckCircle2, Circle, TrendingUp, Sparkles, ArrowRight, Medal, Crown } from "lucide-react";
import { AchievementBadge } from "@/components/achievement-badge";
import { gamificationApi } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { extractErrorMessage } from "@/lib/error-extractor";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

export default function GamificationPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      fetchStats();
    }
  }, [authLoading, user]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await gamificationApi.getStats();
      if (response) {
        setStats(response);
      }
    } catch (error: any) {
      logger.error("Error fetching gamification stats", error);
      const errorMessage = extractErrorMessage(error, "Failed to load gamification data");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Sign in to view your progress</h2>
          <p className="text-muted-foreground">Log in to see your achievements, challenges, and streaks</p>
        </div>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">No data available</h2>
          <p className="text-muted-foreground">Start wagering to earn achievements and level up!</p>
        </div>
      </main>
    );
  }

  const level = stats.level;
  const challenges = stats.daily_challenges || [];
  const achievements = stats.achievements || [];
  const streaks = stats.streaks || [];

  // Calculate completion percentage for challenges
  const activeChallenges = challenges.filter((c: any) => c.status !== "completed" || !c.reward_paid);
  const completedChallenges = challenges.filter((c: any) => c.status === "completed" && c.reward_paid);

  return (
    <main className="flex-1 pb-24 md:pb-0 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-3 mb-4">
            <BackButton position="inline" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                  <Trophy className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">Gamification Hub</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Track your progress, complete challenges, and unlock achievements
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Level Card - Hero Section */}
        {level && (
          <Card className="mb-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                      <div className="relative p-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-yellow-500/50 shadow-lg">
                        <Star className="h-6 w-6 md:h-7 md:w-7 text-yellow-900 fill-yellow-900" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl md:text-3xl font-bold">Level {level.level}</h2>
                        {level.level >= 10 && (
                          <Crown className="h-5 w-5 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Keep wagering to level up!</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Progress to Level {level.level + 1}</span>
                      <span className="font-bold text-foreground">
                        {Number(level.current_level_xp).toLocaleString()} / {Number(level.next_level_xp).toLocaleString()} XP
                      </span>
                    </div>
                    <Progress 
                      value={level.progress_percentage} 
                      className="h-3 md:h-4 bg-muted/50"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{level.progress_percentage}% complete</span>
                      <span className="font-medium">Total: {Number(level.total_xp).toLocaleString()} XP</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50 border border-border/50">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <div className="text-center">
                    <div className="text-2xl font-bold">{level.total_xp.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total XP</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <div className="text-2xl font-bold">{activeChallenges.length}</div>
              <div className="text-xs text-muted-foreground">Challenges</div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Unlocked</span>
              </div>
              <div className="text-2xl font-bold">
                {achievements.filter((a: any) => a.unlocked).length}
              </div>
              <div className="text-xs text-muted-foreground">
                of {achievements.length} Achievements
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Best</span>
              </div>
              <div className="text-2xl font-bold">
                {streaks.length > 0 ? Math.max(...streaks.map((s: any) => s.longest)) : 0}
              </div>
              <div className="text-xs text-muted-foreground">Day Streak</div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <div className="text-2xl font-bold">{completedChallenges.length}</div>
              <div className="text-xs text-muted-foreground">Today</div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Challenges */}
        {challenges.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Daily Challenges</CardTitle>
                    <CardDescription>Complete challenges to earn rewards and XP</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {activeChallenges.length} Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {challenges.map((challenge: any) => {
                  const progress = (challenge.progress / challenge.target) * 100;
                  const isCompleted = challenge.status === "completed";
                  const isClaimed = challenge.reward_paid;
                  const isActive = !isCompleted || !isClaimed;

                  return (
                    <div
                      key={challenge.id}
                      className={cn(
                        "relative p-5 rounded-xl border transition-all",
                        isCompleted && !isClaimed
                          ? "bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-500/30 shadow-md"
                          : isClaimed
                          ? "bg-muted/50 border-border/50"
                          : "bg-card border-border hover:border-primary/50 hover:shadow-md"
                      )}
                    >
                      {isCompleted && !isClaimed && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-green-500 text-white border-0 animate-pulse">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Ready!
                          </Badge>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base mb-1 line-clamp-1">
                              {challenge.title}
                            </h3>
                            {challenge.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {challenge.description}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(challenge.reward_amount, DEFAULT_CURRENCY)}
                            </div>
                            {isClaimed && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Claimed
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">
                              {challenge.progress} / {challenge.target}
                            </span>
                          </div>
                          <Progress
                            value={progress}
                            className={cn(
                              "h-2.5",
                              isCompleted && !isClaimed && "bg-green-500/20"
                            )}
                          />
                        </div>

                        {isCompleted && !isClaimed && (
                          <Button
                            size="sm"
                            className="w-full bg-green-500 hover:bg-green-600 text-white"
                            onClick={async () => {
                              try {
                                await gamificationApi.claimReward(challenge.id);
                                toast({
                                  title: "Reward Claimed!",
                                  description: `You earned ${formatCurrency(challenge.reward_amount, DEFAULT_CURRENCY)}`,
                                });
                                // Refresh stats to update UI
                                await fetchStats();
                              } catch (error: any) {
                                logger.error("Failed to claim reward", error);
                                const errorMessage = extractErrorMessage(error, "Failed to claim reward");
                                toast({
                                  title: "Error",
                                  description: errorMessage,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Gift className="h-4 w-4 mr-2" />
                            Claim Reward
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Achievements & Streaks Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Achievements - Show ALL achievements (locked and unlocked) */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <Award className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Achievements</CardTitle>
                    <CardDescription>
                      {achievements.filter((a: any) => a.unlocked).length} of {achievements.length} unlocked
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-4 gap-4">
                {achievements.map((achievement: any) => (
                  <div key={achievement.type} className="flex flex-col items-center gap-2">
                    <AchievementBadge
                      type={achievement.type}
                      icon={achievement.icon}
                      title={achievement.title}
                      description={achievement.description}
                      requirement={achievement.requirement}
                      unlocked={achievement.unlocked}
                      progress={achievement.progress}
                      target={achievement.target}
                      size="md"
                      showProgress={!achievement.unlocked}
                    />
                    {achievement.unlocked && achievement.unlocked_at && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        {new Date(achievement.unlocked_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Progress Summary */}
              {achievements.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border/50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-yellow-500">
                        {achievements.filter((a: any) => a.unlocked).length}
                      </div>
                      <div className="text-xs text-muted-foreground">Unlocked</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-muted-foreground">
                        {achievements.filter((a: any) => !a.unlocked).length}
                      </div>
                      <div className="text-xs text-muted-foreground">Locked</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {Math.round(
                          (achievements.filter((a: any) => a.unlocked).length / achievements.length) * 100
                        )}%
                      </div>
                      <div className="text-xs text-muted-foreground">Complete</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-500">
                        {achievements
                          .filter((a: any) => !a.unlocked && a.progress_percentage > 0)
                          .length}
                      </div>
                      <div className="text-xs text-muted-foreground">In Progress</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Streaks */}
          {streaks.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Streaks</CardTitle>
                    <CardDescription>Keep the fire burning!</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {streaks.map((streak: any) => {
                    const isActive = streak.current > 0;
                    const streakTypeLabels: Record<string, string> = {
                      login: "Login",
                      win: "Winning",
                      wager: "Activity"
                    };
                    const label = streakTypeLabels[streak.type] || streak.type;

                    return (
                      <div
                        key={streak.type}
                        className={cn(
                          "p-4 rounded-xl border transition-all",
                          isActive
                            ? "bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border-orange-500/30"
                            : "bg-muted/50 border-border/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              isActive ? "bg-orange-500/20" : "bg-muted"
                            )}>
                              <Flame className={cn(
                                "h-5 w-5",
                                isActive ? "text-orange-500" : "text-muted-foreground"
                              )} />
                            </div>
                            <div>
                              <div className="font-semibold capitalize">{label} Streak</div>
                              <div className="text-sm text-muted-foreground">
                                Current: {streak.current} days
                                {streak.longest > streak.current && (
                                  <span className="ml-2">• Best: {streak.longest} days</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isActive && (
                            <Badge className="bg-orange-500 text-white border-0 text-base px-3 py-1">
                              {streak.current} 🔥
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Empty States */}
        {challenges.length === 0 && (!achievements || achievements.length === 0) && streaks.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="p-4 rounded-full bg-muted w-fit mx-auto mb-4">
                <Zap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start Your Journey</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create wagers, join markets, and complete challenges to unlock achievements and level up!
              </p>
              <Button asChild>
                <a href="/wagers">
                  Explore Wagers
                  <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
