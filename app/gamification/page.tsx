"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Flame, Award, Star, Zap, Gift, CheckCircle, Circle } from "lucide-react";
import { gamificationApi } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { extractErrorMessage } from "@/lib/error-extractor";
import { logger } from "@/lib/logger";

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
      // apiGet returns response.data directly, so response is the stats object
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
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground mb-4">Please log in to view your gamification stats</p>
        </div>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground">No gamification data available</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header with integrated back button */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-2">
            <BackButton position="inline" className="mt-1" />
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Gamification</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Track your progress, achievements, and rewards
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Level Card */}
        {stats.level && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Level {stats.level.level}
              </CardTitle>
              <CardDescription>Your current level and XP progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">XP Progress</span>
                    <span className="font-medium">
                      {stats.level.current_level_xp.toLocaleString()} / {stats.level.next_level_xp.toLocaleString()} XP
                    </span>
                  </div>
                  <Progress value={stats.level.progress_percentage} className="h-3" />
                </div>
                <div className="text-sm text-muted-foreground">
                  Total XP: {stats.level.total_xp.toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Challenges */}
        {stats.daily_challenges && stats.daily_challenges.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Daily Challenges
              </CardTitle>
              <CardDescription>Complete challenges to earn rewards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.daily_challenges.map((challenge: any) => (
                  <div
                    key={challenge.id}
                    className="p-4 bg-muted rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium mb-1">{challenge.title}</div>
                        {challenge.description && (
                          <div className="text-sm text-muted-foreground mb-2">
                            {challenge.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(challenge.progress / challenge.target) * 100}
                            className="h-2 flex-1"
                          />
                          <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                            {challenge.progress} / {challenge.target}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-sm font-bold text-green-600">
                          {formatCurrency(challenge.reward_amount, DEFAULT_CURRENCY)}
                        </div>
                        {challenge.reward_paid && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Claimed
                          </Badge>
                        )}
                        {challenge.status === "completed" && !challenge.reward_paid && (
                          <Badge variant="default" className="text-xs mt-1">
                            Claim Reward
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Achievements */}
        {stats.achievements && stats.achievements.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Achievements
              </CardTitle>
              <CardDescription>Badges and achievements you've unlocked</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.achievements.map((achievement: any) => (
                  <div
                    key={achievement.id}
                    className="p-4 bg-muted rounded-lg border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{achievement.icon || "🏆"}</div>
                      <div className="flex-1">
                        <div className="font-medium mb-1">{achievement.title}</div>
                        {achievement.description && (
                          <div className="text-sm text-muted-foreground">
                            {achievement.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(achievement.unlocked_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Streaks */}
        {stats.streaks && stats.streaks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Streaks
              </CardTitle>
              <CardDescription>Your activity streaks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.streaks.map((streak: any) => (
                  <div
                    key={streak.type}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <div>
                        <div className="font-medium capitalize">{streak.type} Streak</div>
                        <div className="text-sm text-muted-foreground">
                          Current: {streak.current} days | Longest: {streak.longest} days
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">{streak.current} 🔥</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

