"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Medal, Award, TrendingUp, Users, Target, Zap } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardUser {
  id: string;
  email: string;
  username: string | null;
  total_wagers: number;
  wins: number;
  win_rate: number;
  total_winnings: number;
  rank: number;
}

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"wins" | "win_rate" | "winnings">("wins");
  const supabase = createClient();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Fetch all profiles
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username");

        if (profilesError) throw profilesError;

        // Fetch all wager entries with amounts
        const { data: wagerEntries, error: entriesError } = await supabase
          .from("wager_entries")
          .select("user_id, wager_id, side, amount");

        if (entriesError) {
          console.error("Error fetching wager entries:", entriesError);
          throw entriesError;
        }

        // Fetch resolved wagers with fee percentage to calculate winnings
        const { data: resolvedWagers, error: wagersError } = await supabase
          .from("wagers")
          .select("id, status, winning_side, fee_percentage")
          .in("status", ["RESOLVED", "SETTLED"])
          .not("winning_side", "is", null);

        if (wagersError) {
          console.error("Error fetching resolved wagers:", wagersError);
          throw wagersError;
        }

        // Calculate stats for each user
        const userStats = new Map<string, {
          total_wagers: number;
          wins: number;
          total_winnings: number;
        }>();

        // Count total wagers per user (count unique wager_ids per user)
        if (wagerEntries && wagerEntries.length > 0) {
          const userWagerSet = new Map<string, Set<string>>();
          
          wagerEntries.forEach((entry: any) => {
            const userId = entry.user_id;
            const wagerId = entry.wager_id;
            
            if (!userWagerSet.has(userId)) {
              userWagerSet.set(userId, new Set());
            }
            userWagerSet.get(userId)!.add(wagerId);
          });
          
          // Set total_wagers based on unique wager count
          userWagerSet.forEach((wagerSet, userId) => {
            if (!userStats.has(userId)) {
              userStats.set(userId, { total_wagers: 0, wins: 0, total_winnings: 0 });
            }
            const stats = userStats.get(userId)!;
            stats.total_wagers = wagerSet.size;
          });
        }

        // Calculate wins and winnings from resolved wagers
        if (resolvedWagers && wagerEntries) {
          resolvedWagers.forEach((wager: any) => {
            const winningSide = wager.winning_side?.toLowerCase() === "a" ? "a" : "b";
            const feePercentage = Number(wager.fee_percentage) || 0.05;
            
            // Get all entries for this wager
            const allWagerEntries = wagerEntries.filter((e: any) => e.wager_id === wager.id);
            
            // Skip if no entries
            if (allWagerEntries.length === 0) return;
            
            // Calculate total pool
            const totalPool = allWagerEntries.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
            
            // Calculate platform fee and winnings pool
            const platformFee = totalPool * feePercentage;
            const winningsPool = totalPool - platformFee;
            
            // Get winning side entries
            const winningEntries = allWagerEntries.filter((e: any) => e.side === winningSide);
            const winningSideTotal = winningEntries.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
            
            // Calculate winnings for each winner (same formula as settlement function)
            if (winningSideTotal > 0 && winningsPool > 0) {
              winningEntries.forEach((entry: any) => {
                const userId = entry.user_id;
                const entryAmount = Number(entry.amount || 0);
                
                // Initialize user stats if not exists
                if (!userStats.has(userId)) {
                  userStats.set(userId, { total_wagers: 0, wins: 0, total_winnings: 0 });
                }
                
                const stats = userStats.get(userId)!;
                stats.wins += 1;
                
                // Calculate proportional winnings: (entryAmount / winningSideTotal) * winningsPool
                const userWinnings = (entryAmount / winningSideTotal) * winningsPool;
                stats.total_winnings += userWinnings;
              });
            }
          });
        }

        // Combine profile data with stats - only include users who have won
        const leaderboardData: LeaderboardUser[] = (profiles || [])
          .map((profile) => {
            const stats = userStats.get(profile.id) || { total_wagers: 0, wins: 0, total_winnings: 0 };
            const winRate = stats.total_wagers > 0 
              ? (stats.wins / stats.total_wagers) * 100 
              : 0;

            return {
              id: profile.id,
              email: "",
              username: profile.username || `User ${profile.id.slice(0, 8)}`,
              total_wagers: stats.total_wagers,
              wins: stats.wins,
              win_rate: winRate,
              total_winnings: stats.total_winnings,
              rank: 0, // Will be set after sorting
            };
          })
          // Filter to only show users who have won at least one wager
          .filter((user) => user.wins > 0);

        // Sort by selected criteria
        leaderboardData.sort((a, b) => {
          if (sortBy === "wins") {
            return b.wins - a.wins;
          } else if (sortBy === "win_rate") {
            return b.win_rate - a.win_rate;
          } else {
            return b.total_winnings - a.total_winnings;
          }
        });

        // Assign ranks
        leaderboardData.forEach((user, index) => {
          user.rank = index + 1;
        });

        setUsers(leaderboardData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        setError(error instanceof Error ? error.message : "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();

    // Subscribe to real-time updates
    const profilesChannel = supabase
      .channel("leaderboard-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    const entriesChannel = supabase
      .channel("leaderboard-entries")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wager_entries" },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    const wagersChannel = supabase
      .channel("leaderboard-wagers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wagers" },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      profilesChannel.unsubscribe();
      entriesChannel.unsubscribe();
      wagersChannel.unsubscribe();
    };
  }, [supabase, sortBy]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />;
    return <span className="text-muted-foreground font-bold">#{rank}</span>;
  };

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
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
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-3 md:mb-4">
          <BackButton fallbackHref="/wagers" />
        </div>
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Leaderboard</h1>
          <p className="text-xs md:text-base text-muted-foreground">
            Top winners and successful bettors on wagr
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 md:p-5 mb-3 md:mb-6">
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <button
              onClick={() => setSortBy("wins")}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition active:scale-[0.95] touch-manipulation ${
                sortBy === "wins"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Most Wins
            </button>
            <button
              onClick={() => setSortBy("win_rate")}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition active:scale-[0.95] touch-manipulation ${
                sortBy === "win_rate"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Best Win Rate
            </button>
            <button
              onClick={() => setSortBy("winnings")}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition active:scale-[0.95] touch-manipulation ${
                sortBy === "winnings"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Total Winnings
            </button>
          </div>
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
                    <h3 className="font-semibold text-sm truncate">
                      {user.username}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <Trophy className="h-3 w-3 text-yellow-500" />
                      <div>
                        <div className="text-muted-foreground">Wins</div>
                        <div className="font-bold text-foreground">{user.wins}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3 text-primary" />
                      <div>
                        <div className="text-muted-foreground">Win Rate</div>
                        <div className="font-bold text-foreground">
                          {user.total_wagers > 0 ? `${user.win_rate.toFixed(1)}%` : "0%"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-green-500" />
                      <div>
                        <div className="text-muted-foreground">Winnings</div>
                        <div className="font-bold text-green-600 dark:text-green-400 text-xs">
                          {formatCurrency(user.total_winnings, DEFAULT_CURRENCY as Currency)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-blue-500" />
                      <div>
                        <div className="text-muted-foreground">Total Wagers</div>
                        <div className="font-bold text-foreground">{user.total_wagers}</div>
                      </div>
                    </div>
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
                    <h3 className="font-semibold text-base lg:text-lg truncate">
                      {user.username}
                    </h3>
                  </div>
                  
                  {/* Wins */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-24">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Wins</div>
                      <div className="font-bold text-foreground">{user.wins}</div>
                    </div>
                  </div>
                  
                  {/* Win Rate */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-28">
                    <Target className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                      <div className="font-bold text-foreground">
                        {user.total_wagers > 0 ? `${user.win_rate.toFixed(1)}%` : "0%"}
                      </div>
                    </div>
                  </div>
                  
                  {/* Winnings */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-32 lg:w-40">
                    <Zap className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Winnings</div>
                      <div className="font-bold text-green-600 dark:text-green-400 text-sm">
                        {formatCurrency(user.total_winnings, DEFAULT_CURRENCY as Currency)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Total Wagers */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-28">
                    <Users className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Wagers</div>
                      <div className="font-bold text-foreground">{user.total_wagers}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

