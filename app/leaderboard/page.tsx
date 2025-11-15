"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Medal, Award, TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardUser {
  id: string;
  email: string;
  username: string | null;
  balance: number;
  total_wagers: number;
  wins: number;
  win_rate: number;
  rank: number;
}

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"balance" | "wins" | "win_rate">("balance");
  const supabase = createClient();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Fetch all profiles with balance
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, balance")
          .order("balance", { ascending: false });

        if (profilesError) throw profilesError;

        // Fetch all wager entries
        const { data: wagerEntries } = await supabase
          .from("wager_entries")
          .select("user_id, wager_id, side");

        // Fetch resolved wagers to calculate wins
        const { data: resolvedWagers } = await supabase
          .from("wagers")
          .select("id, status, winning_side")
          .eq("status", "RESOLVED")
          .not("winning_side", "is", null);

        // Calculate stats for each user
        const userStats = new Map<string, {
          total_wagers: number;
          wins: number;
        }>();

        // Count total wagers per user
        if (wagerEntries) {
          wagerEntries.forEach((entry: any) => {
            const userId = entry.user_id;
            if (!userStats.has(userId)) {
              userStats.set(userId, { total_wagers: 0, wins: 0 });
            }
            const stats = userStats.get(userId)!;
            stats.total_wagers += 1;
          });
        }

        // Calculate wins
        if (resolvedWagers && wagerEntries) {
          const resolvedWagerIds = new Set(resolvedWagers.map(w => w.id));
          resolvedWagers.forEach((wager) => {
            const winningSide = wager.winning_side?.toLowerCase() === "a" ? "a" : "b";
            wagerEntries
              .filter((entry: any) => 
                entry.wager_id === wager.id && 
                entry.side === winningSide &&
                resolvedWagerIds.has(entry.wager_id)
              )
              .forEach((entry: any) => {
                const userId = entry.user_id;
                if (userStats.has(userId)) {
                  userStats.get(userId)!.wins += 1;
                }
              });
          });
        }

        // Combine profile data with stats - only include users who have won
        const leaderboardData: LeaderboardUser[] = (profiles || [])
          .map((profile) => {
            const stats = userStats.get(profile.id) || { total_wagers: 0, wins: 0 };
            const winRate = stats.total_wagers > 0 
              ? (stats.wins / stats.total_wagers) * 100 
              : 0;

            return {
              id: profile.id,
              email: "", // We'll fetch this separately if needed
              username: profile.username || `User ${profile.id.slice(0, 8)}`,
              balance: Number(profile.balance) || 0,
              total_wagers: stats.total_wagers,
              wins: stats.wins,
              win_rate: winRate,
              rank: 0, // Will be set after sorting
            };
          })
          // Filter to only show users who have won at least one wager
          .filter((user) => user.wins > 0);

        // Sort by selected criteria
        leaderboardData.sort((a, b) => {
          if (sortBy === "balance") {
            return b.balance - a.balance;
          } else if (sortBy === "wins") {
            return b.wins - a.wins;
          } else {
            return b.win_rate - a.win_rate;
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
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Leaderboard</h1>
          <p className="text-xs md:text-base text-muted-foreground">
            Top winners and successful bettors on wagr
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 md:p-5 mb-3 md:mb-6">
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <button
              onClick={() => setSortBy("balance")}
              className={`px-2 py-1 md:px-4 md:py-2 rounded-md text-[10px] md:text-sm font-medium transition active:scale-[0.95] touch-manipulation ${
                sortBy === "balance"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Sort by Balance
            </button>
            <button
              onClick={() => setSortBy("wins")}
              className={`px-2 py-1 md:px-4 md:py-2 rounded-md text-[10px] md:text-sm font-medium transition active:scale-[0.95] touch-manipulation ${
                sortBy === "wins"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Sort by Wins
            </button>
            <button
              onClick={() => setSortBy("win_rate")}
              className={`px-2 py-1 md:px-4 md:py-2 rounded-md text-[10px] md:text-sm font-medium transition active:scale-[0.95] touch-manipulation ${
                sortBy === "win_rate"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Sort by Win Rate
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
                className={`bg-card border border-border rounded-lg p-2.5 md:p-5 transition hover:border-primary active:scale-[0.99] touch-manipulation ${
                  user.rank <= 3 ? "ring-2 ring-primary/20" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-6 md:w-12 flex items-center justify-center">
                      {getRankIcon(user.rank)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-xs md:text-lg truncate">
                        {user.username}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 md:gap-4 mt-1 md:mt-2 text-[9px] md:text-sm text-muted-foreground">
                        <span className="flex items-center gap-0.5 md:gap-1">
                          <TrendingUp className="h-2.5 w-2.5 md:h-4 md:w-4" />
                          Balance: <span className="font-semibold text-foreground">{user.balance.toFixed(2)}</span>
                        </span>
                        <span>
                          Wins: <span className="font-semibold text-foreground">{user.wins}</span>
                        </span>
                        <span>
                          Wagers: <span className="font-semibold text-foreground">{user.total_wagers}</span>
                        </span>
                        {user.total_wagers > 0 && (
                          <span>
                            Win Rate: <span className="font-semibold text-foreground">{user.win_rate.toFixed(1)}%</span>
                          </span>
                        )}
                      </div>
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

