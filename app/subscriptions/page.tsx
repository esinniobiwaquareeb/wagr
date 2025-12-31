"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, X, Loader2, Sparkles } from "lucide-react";
import { subscriptionsApi } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { extractErrorMessage } from "@/lib/error-extractor";
import { logger } from "@/lib/logger";

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [benefits, setBenefits] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user]);

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
    } catch (error: any) {
      logger.error("Error fetching subscription data", error);
      const errorMessage = extractErrorMessage(error, "Failed to load subscription data");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to subscribe",
        variant: "destructive",
      });
      router.push("/wagers?login=true");
      return;
    }

    setSubscribing(true);
    try {
      // In a real implementation, you would integrate with payment gateway here
      // For now, we'll just show a message
      toast({
        title: "Subscription",
        description: "Payment integration coming soon. For now, contact support to upgrade.",
        variant: "default",
      });
      
      // Uncomment when payment is integrated:
      // const response = await subscriptionsApi.subscribe();
      // if (response?.data) {
      //   setStatus(response.data);
      //   toast({
      //     title: "Success!",
      //     description: "You've successfully subscribed to Premium",
      //   });
      //   fetchData();
      // }
    } catch (error: any) {
      logger.error("Error subscribing", error);
      const errorMessage = extractErrorMessage(error, "Failed to subscribe");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = async () => {
    if (!status?.subscription) return;

    setCancelling(true);
    try {
      await subscriptionsApi.cancel();
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will remain active until it expires.",
      });
      fetchData();
    } catch (error: any) {
      logger.error("Error cancelling subscription", error);
      const errorMessage = extractErrorMessage(error, "Failed to cancel subscription");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  if (authLoading || loading) {
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
          <p className="text-muted-foreground mb-4">Please log in to view subscriptions</p>
        </div>
      </main>
    );
  }

  const isPremium = status?.is_premium || false;
  const subscription = status?.subscription;

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <BackButton />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Crown className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Subscriptions</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Upgrade to Premium for exclusive benefits
              </p>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your current subscription status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isPremium ? (
                  <>
                    <Crown className="h-8 w-8 text-yellow-500" />
                    <div>
                      <div className="font-bold text-lg">Premium</div>
                      {subscription?.expires_at && (
                        <div className="text-sm text-muted-foreground">
                          Expires: {new Date(subscription.expires_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="font-bold text-lg">Free</div>
                      <div className="text-sm text-muted-foreground">Standard features</div>
                    </div>
                  </>
                )}
              </div>
              {isPremium && (
                <Badge variant="default" className="text-sm">
                  Active
                </Badge>
              )}
            </div>

            {isPremium && subscription && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  onClick={handleCancel}
                  disabled={cancelling}
                  variant="outline"
                  size="sm"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel Subscription"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Premium Benefits */}
        {benefits && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Premium Benefits
              </CardTitle>
              <CardDescription>
                {formatCurrency(benefits.monthly_price, DEFAULT_CURRENCY)}/month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {benefits.benefits && benefits.benefits.length > 0 ? (
                  <div className="space-y-3">
                    {benefits.benefits.map((benefit: string, index: number) => (
                      <div key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{benefit}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Lower platform fees (2% vs 5%)</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Advanced analytics dashboard</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Early access to new wagers</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Priority customer support</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Custom badges and profile themes</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Exclusive premium-only wagers</span>
                    </div>
                  </div>
                )}

                {!isPremium && (
                  <div className="mt-6 pt-6 border-t">
                    <Button
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      size="lg"
                      className="w-full"
                    >
                      {subscribing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Crown className="h-4 w-4 mr-2" />
                          Subscribe to Premium - {formatCurrency(benefits.monthly_price || 2000, DEFAULT_CURRENCY)}/month
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

