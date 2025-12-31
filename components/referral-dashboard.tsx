"use client";

import { useState, useEffect } from "react";
import { Copy, Share2, Users, TrendingUp, Gift, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { referralsApi } from "@/lib/api-client";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";

export function ReferralDashboard() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [codeResponse, statsResponse] = await Promise.all([
        referralsApi.getCode(),
        referralsApi.getStats(),
      ]);

      if (codeResponse?.data?.referral_code) {
        setReferralCode(codeResponse.data.referral_code);
      }

      if (statsResponse?.data) {
        setStats(statsResponse.data);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load referral data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!referralCode) return;

    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy referral code",
        variant: "destructive",
      });
    }
  };

  const shareCode = () => {
    if (!referralCode) return;

    const shareUrl = `${window.location.origin}/register?ref=${referralCode}`;
    const shareText = `Join wagered.app and get ₦500 bonus! Use my referral code: ${referralCode}`;

    if (navigator.share) {
      navigator.share({
        title: "Join wagered.app",
        text: shareText,
        url: shareUrl,
      }).catch(() => {
        // Fallback to copy
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast({
          title: "Link copied!",
          description: "Share link copied to clipboard",
        });
      });
    } else {
      // Fallback to copy
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast({
        title: "Link copied!",
        description: "Share link copied to clipboard",
      });
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

  return (
    <div className="space-y-6">
      {/* Referral Code Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Code</CardTitle>
          <CardDescription>
            Share your code and earn ₦500 for each friend who signs up!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {referralCode && (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 bg-muted rounded-lg font-mono text-lg font-bold">
                {referralCode}
              </div>
              <Button onClick={copyCode} variant="outline" size="icon">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button onClick={shareCode} variant="default">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p>• You get ₦500 when someone signs up with your code</p>
            <p>• They also get ₦500 welcome bonus</p>
            <p>• Share via WhatsApp, Twitter, or any platform</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      {stats && (
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
                <div className="text-sm font-mono">{stats.referral_code || referralCode}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Referrals */}
      {stats?.referrals && stats.referrals.length > 0 && (
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

