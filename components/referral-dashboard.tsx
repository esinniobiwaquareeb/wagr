"use client";

import { useState, useEffect } from "react";
import { Users, TrendingUp, Gift, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { referralsApi } from "@/lib/api-client";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";

export function ReferralDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currency = DEFAULT_CURRENCY;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const statsResponse = await referralsApi.getStats();

      // apiGet returns response.data directly, so statsResponse is the stats object
      if (statsResponse) {
        setStats(statsResponse);
      }
    } catch (error: any) {
      logger.error("Error fetching referral stats", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div className="text-2xl font-bold">{stats.total_referrals || 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Earnings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div className="text-2xl font-bold">
                {formatCurrency(stats.total_earnings || 0, currency)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Referral Code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm font-mono">{stats.referral_code || "N/A"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Referrals */}
      {stats.referrals && stats.referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>People who signed up with your code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.referrals.slice(0, 5).map((ref: any) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {ref.referee?.username || ref.referee?.email || "User"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    {ref.referrer_reward_paid ? "✓ Paid" : "Pending"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

