"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Star, Flame, Target, Award, Loader2 } from "lucide-react";
import { gamificationApi } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function GamificationSection() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await gamificationApi.getStats();
      // apiGet returns response.data directly, so response is the stats object
      if (response) {
        setStats(response);
      }
    } catch (error) {
      logger.error("Error fetching gamification stats", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span>Gamification</span>
          </h3>
        </div>
        <div className="text-center py-4">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span>Gamification</span>
          </h3>
          <Link
            href="/gamification"
            className="text-xs text-primary hover:underline"
          >
            View All
          </Link>
        </div>
        <p className="text-sm text-muted-foreground py-4">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span>Gamification</span>
        </h3>
        <Link
          href="/gamification"
          className="text-xs text-primary hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="space-y-4">
        {/* Level */}
        {stats.level && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-muted-foreground">Level {stats.level.level}</span>
              </div>
              <span className="font-semibold">
                {stats.level.current_level_xp?.toLocaleString() || 0} / {stats.level.next_level_xp?.toLocaleString() || 0} XP
              </span>
            </div>
            <Progress value={stats.level.progress_percentage || 0} className="h-2" />
          </div>
        )}

        {/* Achievements Count */}
        {stats.achievements && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Award className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-muted-foreground">Achievements</span>
            </div>
            <span className="font-semibold">{stats.achievements.length || 0}</span>
          </div>
        )}

        {/* Active Challenges */}
        {stats.daily_challenges && stats.daily_challenges.length > 0 && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Active Challenges</span>
            </div>
            <span className="font-semibold">{stats.daily_challenges.length}</span>
          </div>
        )}

        {/* Streaks */}
        {stats.streaks && stats.streaks.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            {stats.streaks.slice(0, 2).map((streak: any) => (
              <div key={streak.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-muted-foreground capitalize">{streak.type} Streak</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {streak.current} 🔥
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

