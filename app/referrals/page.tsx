"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Trophy } from "lucide-react";
import { referralsApi } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { ReferralCodeCard } from "@/components/referral-code-card";
import { ReferralDashboard } from "@/components/referral-dashboard";

export default function ReferralsPage() {
  const { user, loading: authLoading } = useAuth();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      fetchLeaderboard();
    }
  }, [authLoading]);

  const fetchLeaderboard = async () => {
    try {
      setLoadingLeaderboard(true);
      const response = await referralsApi.getLeaderboard(10);
      if (response?.leaderboard) {
        setLeaderboard(response.leaderboard);
      }
    } catch (error: any) {
      console.error("Error fetching leaderboard", error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  if (authLoading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-3 md:px-6 py-3 md:py-6">
          <Skeleton className="h-8 md:h-10 w-32 mb-4 md:mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-3 md:px-6 py-8 md:py-12 text-center">
          <p className="text-sm md:text-base text-muted-foreground mb-4">Please log in to view referrals</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-3 md:py-6 w-full">
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold mb-1">Referrals</h1>
          <p className="text-sm text-muted-foreground">
            Invite friends and earn rewards
          </p>
        </div>

        {/* Referral Code Card */}
        <div className="mb-4 md:mb-6">
          <ReferralCodeCard variant="full" showStats={true} />
        </div>

        {/* Referral Dashboard */}
        <div className="mb-4 md:mb-6">
          <ReferralDashboard />
        </div>

        {/* Leaderboard */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Top Referrers</CardTitle>
            <CardDescription className="text-xs">Users with the most successful referrals</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLeaderboard ? (
              <div className="space-y-2 md:space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 md:h-16 w-full" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 md:py-8 text-sm">
                No referrals yet. Be the first!
              </p>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {leaderboard.map((item, index) => (
                  <div
                    key={item.user.id}
                    className="flex items-center justify-between p-3 md:p-4 bg-muted rounded-lg gap-2 md:gap-4"
                  >
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 font-bold flex-shrink-0">
                        {index === 0 ? (
                          <Trophy className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />
                        ) : (
                          <span className="text-xs md:text-sm">#{index + 1}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm md:text-base truncate">
                          {item.user.username || item.user.email || "User"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.total_referrals} referral{item.total_referrals !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-green-600 text-sm md:text-base">
                        {formatCurrency(item.total_earnings, DEFAULT_CURRENCY)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Earnings</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

