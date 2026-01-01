"use client";

import { useEffect, useState, useCallback } from "react";
import { Trophy, Medal, Award, Users, Target, Zap } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import { leaderboardApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { maskUsername } from "@/lib/utils";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeaderboardUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
  total_wagers?: number;
  wins?: number;
  losses?: number;
  win_rate?: number;
  total_winnings?: number;
  balance?: number;
  rank: number;
}

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"balance" | "wins" | "win_rate" | "winnings">("wins");
  const { toast } = useToast();

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const type = sortBy;
      const response = await leaderboardApi.get({ type, limit: 100 });
      
      const leaderboardData: LeaderboardUser[] = (response.leaderboard || []).map((item: any) => ({
        id: item.id || item.user?.id,
        username: item.username || item.user?.username || null,
        avatar_url: item.avatar_url || item.user?.avatar_url || null,
        total_wagers: item.total_wagers,
        wins: item.wins,
        losses: item.losses,
        win_rate: item.win_rate,
        total_winnings: item.total_winnings,
        balance: item.balance,
        rank: item.rank,
      }));

      setUsers(leaderboardData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load leaderboard";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [sortBy, toast]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />;
    return <span className="text-muted-foreground font-bold">#{rank}</span>;
  };

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-3 md:py-6">
        <div className="mb-4 md:mb-6">
          {/* Header with integrated back button */}
          <div className="flex items-center justify-between gap-3 md:gap-4 mb-2 md:mb-3">
            <div className="flex items-center gap-3 flex-1">
              <BackButton position="inline" fallbackHref="/wagers" />
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold">Leaderboard</h1>
            </div>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as "balance" | "wins" | "win_rate" | "winnings")}>
              <SelectTrigger className="w-[140px] md:w-[180px]">
                <SelectValue>
                  {sortBy === "balance" ? "Balance" : sortBy === "wins" ? "Most Wins" : sortBy === "win_rate" ? "Best Win Rate" : "Total Winnings"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="balance">Balance</SelectItem>
                <SelectItem value="wins">Most Wins</SelectItem>
                <SelectItem value="win_rate">Best Win Rate</SelectItem>
                <SelectItem value="winnings">Total Winnings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs md:text-base text-muted-foreground">
            Top winners and successful bettors on wagr
          </p>
        </div>

        {error ? (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <p className="text-destructive mb-2">Error loading leaderboard</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No winners yet</p>
            <p className="text-xs md:text-sm text-muted-foreground">Be the first to win a wager!</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className={`bg-card border border-border rounded-lg p-2.5 md:p-4 transition hover:border-primary active:scale-[0.99] touch-manipulation ${
                  user.rank <= 3 ? "ring-2 ring-primary/20" : ""
                }`}
              >
                {/* Mobile Layout */}
                <div className="md:hidden">
                  <div className="flex items-center gap-2 flex-1 min-w-0 mb-2">
                    <div className="flex-shrink-0 w-6 flex items-center justify-center">
                      {getRankIcon(user.rank)}
                    </div>
                    <Link
                      href={`/profile/${user.username || user.id}`}
                      className="font-semibold text-sm truncate hover:text-primary hover:underline inline-block"
                    >
                      {maskUsername(user.username)}
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {sortBy === "balance" ? (
                      <>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-green-500" />
                          <div>
                            <div className="text-muted-foreground">Balance</div>
                            <div className="font-bold text-green-600 dark:text-green-400 text-xs">
                              {formatCurrency(user.balance || 0, DEFAULT_CURRENCY as Currency)}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-yellow-500" />
                          <div>
                            <div className="text-muted-foreground">Wins</div>
                            <div className="font-bold text-foreground">{user.wins || 0}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-primary" />
                          <div>
                            <div className="text-muted-foreground">Win Rate</div>
                            <div className="font-bold text-foreground">
                              {(user.total_wagers || 0) > 0 ? `${(user.win_rate || 0).toFixed(1)}%` : "0%"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-green-500" />
                          <div>
                            <div className="text-muted-foreground">Winnings</div>
                            <div className="font-bold text-green-600 dark:text-green-400 text-xs">
                              {formatCurrency(user.total_winnings || 0, DEFAULT_CURRENCY as Currency)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-blue-500" />
                          <div>
                            <div className="text-muted-foreground">Total Wagers</div>
                            <div className="font-bold text-foreground">{user.total_wagers || 0}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Desktop Layout - Single Line */}
                <div className="hidden md:flex items-center gap-4 lg:gap-6">
                  {/* Rank Icon */}
                  <div className="flex-shrink-0 w-12 flex items-center justify-center">
                    {getRankIcon(user.rank)}
                  </div>
                  
                  {/* Username */}
                  <div className="flex-shrink-0 w-48 lg:w-64">
                    <Link
                      href={`/profile/${user.username || user.id}`}
                      className="font-semibold text-base lg:text-lg truncate hover:text-primary hover:underline inline-block"
                    >
                      {maskUsername(user.username)}
                    </Link>
                  </div>
                  
                  {sortBy === "balance" ? (
                    /* Balance */
                    <div className="flex items-center gap-2 flex-shrink-0 w-32 lg:w-40">
                      <Zap className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Balance</div>
                        <div className="font-bold text-green-600 dark:text-green-400 text-sm">
                          {formatCurrency(user.balance || 0, DEFAULT_CURRENCY as Currency)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Wins */}
                      <div className="flex items-center gap-2 flex-shrink-0 w-24">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        <div>
                          <div className="text-xs text-muted-foreground">Wins</div>
                          <div className="font-bold text-foreground">{user.wins || 0}</div>
                        </div>
                      </div>
                      
                      {/* Win Rate */}
                      <div className="flex items-center gap-2 flex-shrink-0 w-28">
                        <Target className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-xs text-muted-foreground">Win Rate</div>
                          <div className="font-bold text-foreground">
                            {(user.total_wagers || 0) > 0 ? `${(user.win_rate || 0).toFixed(1)}%` : "0%"}
                          </div>
                        </div>
                      </div>
                      
                      {/* Winnings */}
                      <div className="flex items-center gap-2 flex-shrink-0 w-32 lg:w-40">
                        <Zap className="h-4 w-4 text-green-500" />
                        <div>
                          <div className="text-xs text-muted-foreground">Winnings</div>
                          <div className="font-bold text-green-600 dark:text-green-400 text-sm">
                            {formatCurrency(user.total_winnings || 0, DEFAULT_CURRENCY as Currency)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Total Wagers */}
                      <div className="flex items-center gap-2 flex-shrink-0 w-28">
                        <Users className="h-4 w-4 text-blue-500" />
                        <div>
                          <div className="text-xs text-muted-foreground">Wagers</div>
                          <div className="font-bold text-foreground">{user.total_wagers || 0}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

