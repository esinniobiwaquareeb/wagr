"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Crown, Sparkles, Loader2, Check } from "lucide-react";
import { subscriptionsApi } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";

export function SubscriptionsSection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [benefits, setBenefits] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statusResponse, benefitsResponse] = await Promise.all([
        subscriptionsApi.getStatus(),
        subscriptionsApi.getBenefits(),
      ]);

      // apiGet returns response.data directly
      // getStatus returns { is_premium: boolean; subscription: any }
      if (statusResponse) {
        setStatus(statusResponse);
      }

      // getBenefits returns the benefits object
      if (benefitsResponse) {
        setBenefits(benefitsResponse);
      }
    } catch (error) {
      logger.error("Error fetching subscription data", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const isPremium = status?.is_premium || false;
  const subscription = status?.subscription;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <span>Subscription</span>
          </h3>
        </div>
        <div className="text-center py-4">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <span>Subscription</span>
        </h3>
        <Link
          href="/subscriptions"
          className="text-xs text-primary hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="space-y-3">
        {/* Current Plan */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPremium ? (
              <>
                <Crown className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-sm font-semibold">Premium</div>
                  {subscription?.expires_at && (
                    <div className="text-xs text-muted-foreground">
                      Expires {new Date(subscription.expires_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-semibold">Free</div>
                  <div className="text-xs text-muted-foreground">Standard features</div>
                </div>
              </>
            )}
          </div>
          {isPremium && (
            <Badge variant="default" className="text-xs">
              Active
            </Badge>
          )}
        </div>

        {/* Benefits Preview */}
        {benefits && !isPremium && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2">
              Premium: {formatCurrency(benefits.monthly_price || 2000, DEFAULT_CURRENCY)}/month
            </div>
            <div className="space-y-1">
              {benefits.benefits?.slice(0, 2).map((benefit: string, index: number) => (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

