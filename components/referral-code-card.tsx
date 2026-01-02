"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Share2, Gift, Check, Loader2, Twitter, Facebook, MessageCircle, Link2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { referralsApi } from "@/lib/api-client";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { logger } from "@/lib/logger";
import Link from "next/link";
import { useSettings } from "@/hooks/use-settings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReferralCodeCardProps {
  /**
   * Show a compact version (for sidebar/profile)
   * or full version (for referrals page)
   */
  variant?: "compact" | "full";
  /**
   * Show stats in the card
   */
  showStats?: boolean;
  /**
   * Show link to full dashboard (only in compact mode)
   */
  showDashboardLink?: boolean;
  /**
   * Custom className for the card
   */
  className?: string;
}

export function ReferralCodeCard({
  variant = "compact",
  showStats = true,
  showDashboardLink = true,
  className = "",
}: ReferralCodeCardProps) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { toast } = useToast();
  const { getReferralRewards } = useSettings();
  const { referrerReward, refereeReward } = getReferralRewards();
  const currency = DEFAULT_CURRENCY;

  const fetchReferralData = useCallback(async () => {
    try {
      setLoading(true);
      const [codeResponse, statsResponse] = await Promise.all([
        referralsApi.getCode().catch((err) => {
          logger.error("Error fetching referral code", err);
          return null;
        }),
        showStats
          ? referralsApi.getStats().catch((err) => {
              logger.error("Error fetching referral stats", err);
              return null;
            })
          : Promise.resolve(null),
      ]);

      // apiGet returns response.data, so codeResponse is { referral_code: string }
      if (codeResponse?.referral_code) {
        setReferralCode(codeResponse.referral_code);
      }

      // statsResponse is the data object directly
      if (statsResponse) {
        setReferralStats(statsResponse);
      }
    } catch (error) {
      logger.error("Error fetching referral data", error);
      toast({
        title: "Error",
        description: "Failed to load referral information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [showStats, toast]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

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

  // Get referral link and share text
  const getReferralLink = useCallback(() => {
    if (!referralCode) return { url: "", text: "" };
    const shareUrl = `${window.location.origin}/wagers?ref=${referralCode}`;
    const bonusText = formatCurrency(refereeReward, currency);
    const shareText = `🎉 Join wagered.app and get ${bonusText} bonus! Use my referral code: ${referralCode}\n\n${shareUrl}`;
    return { url: shareUrl, text: shareText };
  }, [referralCode, refereeReward, currency]);

  const copyReferralLink = async () => {
    if (!referralCode) return;
    const { url, text } = getReferralLink();
    try {
      await navigator.clipboard.writeText(text);
      setLinkCopied(true);
      toast({
        title: "Link copied!",
        description: "Referral link copied to clipboard",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const shareNative = async () => {
    if (!referralCode) return;
    const { url, text } = getReferralLink();
    
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const bonusText = formatCurrency(refereeReward, currency);
        await navigator.share({
          title: "Join wagered.app",
          text: `🎉 Join wagered.app and get ${bonusText} bonus! Use my referral code: ${referralCode}`,
          url: url,
        });
      } catch (error) {
        // User cancelled or error occurred - fallback to copy
        copyReferralLink();
      }
    } else {
      copyReferralLink();
    }
  };

  const shareTwitter = () => {
    if (!referralCode) return;
    const { url } = getReferralLink();
    const bonusText = formatCurrency(refereeReward, currency);
    const twitterText = `🎉 Join wagered.app and get ${bonusText} bonus! Use my referral code: ${referralCode}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  };

  const shareFacebook = () => {
    if (!referralCode) return;
    const { url } = getReferralLink();
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(facebookUrl, "_blank", "width=550,height=420");
  };

  const shareWhatsApp = () => {
    if (!referralCode) return;
    const { url, text } = getReferralLink();
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  if (variant === "compact") {
    return (
      <div className={`bg-card border border-border rounded-xl p-4 md:p-5 ${className}`}>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Referral Code
        </h3>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent mx-auto" />
          </div>
        ) : referralCode ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-sm font-bold text-center">
                {referralCode}
              </div>
              <button
                onClick={copyCode}
                className="p-2 hover:bg-muted rounded-lg transition active:scale-95 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Copy code"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 hover:bg-muted rounded-lg transition active:scale-95 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Share referral link"
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <DropdownMenuItem onClick={shareNative} className="cursor-pointer">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share via...
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={shareWhatsApp} className="cursor-pointer">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareTwitter} className="cursor-pointer">
                    <Twitter className="h-4 w-4 mr-2" />
                    Twitter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareFacebook} className="cursor-pointer">
                    <Facebook className="h-4 w-4 mr-2" />
                    Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyReferralLink} className="cursor-pointer">
                    {linkCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {referralStats && showStats && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Referrals</span>
                  <span className="font-semibold">{referralStats.total_referrals || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Earnings</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(referralStats.total_earnings || 0, currency)}
                  </span>
                </div>
              </div>
            )}
            {showDashboardLink && (
              <Link
                href="/referrals"
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition active:scale-95 touch-manipulation text-sm font-medium min-h-[44px]"
              >
                <Gift className="h-4 w-4" />
                <span>View Full Dashboard</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">Unable to load referral code</p>
            <button
              onClick={fetchReferralData}
              className="text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full variant for referrals page
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Your Referral Code</CardTitle>
        <CardDescription>
          Share your code and earn {formatCurrency(referrerReward, currency)} for each friend who signs up!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading referral code...</p>
          </div>
        ) : referralCode ? (
          <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-muted rounded-lg font-mono text-sm sm:text-lg font-bold break-all sm:break-normal overflow-x-auto">
                {referralCode}
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={copyCode} variant="outline" size="icon" title="Copy code" className="flex-shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" className="flex-shrink-0">
                      <Share2 className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Share</span>
                      <ChevronDown className="h-3 w-3 ml-1 hidden sm:inline" />
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <DropdownMenuItem onClick={shareNative} className="cursor-pointer">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share via...
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={shareWhatsApp} className="cursor-pointer">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareTwitter} className="cursor-pointer">
                    <Twitter className="h-4 w-4 mr-2" />
                    Twitter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareFacebook} className="cursor-pointer">
                    <Facebook className="h-4 w-4 mr-2" />
                    Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyReferralLink} className="cursor-pointer">
                    {linkCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
              <p>• You get {formatCurrency(referrerReward, currency)} when someone signs up with your code</p>
              <p>• They also get {formatCurrency(refereeReward, currency)} welcome bonus</p>
              <p>• Share your referral link via WhatsApp, Twitter, Facebook, or copy the link</p>
            </div>

            {referralStats && showStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 pt-3 md:pt-4 border-t border-border">
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold">{referralStats.total_referrals || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Referrals</div>
                </div>
                <div className="text-center">
                  <div className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400 break-all">
                    {formatCurrency(referralStats.total_earnings || 0, currency)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total Earnings</div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm font-mono font-bold break-all">{referralCode}</div>
                  <div className="text-xs text-muted-foreground mt-1">Your Code</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">Unable to load referral code</p>
            <Button onClick={fetchReferralData} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

