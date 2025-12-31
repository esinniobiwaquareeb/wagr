"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ReferralDashboard } from "@/components/referral-dashboard";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, TrendingUp, Users, Trophy } from "lucide-react";
import { referralsApi } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";

export default function ReferralsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
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
      if (response?.data?.leaderboard) {
        setLeaderboard(response.data.leaderboard);
      }
    } catch (error: any) {
      // Silently fail for leaderboard
      console.error("Error fetching leaderboard", error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  if (authLoading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <Skeleton className="h-10 w-32 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground mb-4">Please log in to view referrals</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <BackButton />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Gift className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Referrals</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Invite friends and earn rewards
              </p>
            </div>
          </div>
        </div>

        {/* Referral Dashboard */}
        <div className="mb-6">
          <ReferralDashboard />
        </div>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
            <CardDescription>Users with the most successful referrals</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLeaderboard ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No referrals yet. Be the first!
              </p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((item, index) => (
                  <div
                    key={item.user.id}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 font-bold">
                        {index === 0 ? (
                          <Trophy className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <span className="text-sm">#{index + 1}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {item.user.username || item.user.email || "User"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.total_referrals} referral{item.total_referrals !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
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

