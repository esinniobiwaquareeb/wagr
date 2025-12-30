"use client";

import Link from "next/link";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, User, Users, TrendingUp, Coins, Calendar, Trophy, CheckCircle2, Loader2, Check, X, Clock, Flame } from "lucide-react";
import { format } from "date-fns";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";
import { DeadlineDisplay } from "@/components/deadline-display";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";
import { wagersApi } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { isDeadlineElapsed, getTimeRemaining } from "@/lib/deadline-utils";
import { useState } from "react";
import * as React from "react";

// Format volume/pool display like Polymarket (e.g., "$432k Vol", "$2m Vol")
function formatVolume(amount: number, currency: Currency = 'NGN'): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}k`;
  }
  return amount.toFixed(0);
}

interface WagerCardProps {
  id: string;
  title: string;
  description: string;
  sideA: string;
  sideB: string;
  amount: number;
  status: string;
  entriesCount: number;
  deadline: string;
  currency?: string;
  isSystemGenerated?: boolean;
  category?: string;
  sideACount?: number;
  sideBCount?: number;
  sideATotal?: number; // Total amount wagered on side A
  sideBTotal?: number; // Total amount wagered on side B
  feePercentage?: number;
  createdAt?: string;
  winningSide?: string | null;
  shortId?: string | null;
  userEntryAmount?: number; // User's entry amount if they participated
  userEntrySide?: string; // User's chosen side ('a' or 'b')
  onClick?: () => void;
}

export function WagerCard({
  id,
  title,
  description,
  sideA,
  sideB,
  amount,
  status,
  entriesCount,
  deadline,
  currency = DEFAULT_CURRENCY,
  isSystemGenerated = false,
  category,
  sideACount = 0,
  sideBCount = 0,
  sideATotal = 0,
  sideBTotal = 0,
  feePercentage = 0.05,
  createdAt,
  winningSide,
  shortId,
  userEntryAmount,
  userEntrySide,
  onClick,
}: WagerCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getSetting } = useSettings();
  const [joiningSide, setJoiningSide] = useState<"a" | "b" | null>(null);
  
  // Get effective fee percentage from settings or use prop/default
  const effectiveFeePercentage = feePercentage || (getSetting('fees.wager_platform_fee_percentage', PLATFORM_FEE_PERCENTAGE) as number);
  
  const isOpen = status === "OPEN";
  const isResolved = status === "RESOLVED" || status === "SETTLED";
  const isSettled = status === "SETTLED";
  const sideAWon = isResolved && winningSide === "a";
  const sideBWon = isResolved && winningSide === "b";
  // Check if user has participated - userEntrySide should be 'a' or 'b'
  const userParticipated = userEntrySide === "a" || userEntrySide === "b";
  
  // Reset joining state when user participation status changes or wager status changes
  React.useEffect(() => {
    setJoiningSide(null);
  }, [id, userParticipated, status]);
  
  // Use deadline countdown hook
  const { status: deadlineStatus } = useDeadlineCountdown(deadline);
  
  const formattedAmount = formatCurrency(amount, currency as Currency);
  const isUrgent = deadline && deadlineStatus !== 'green';

  const handleQuickBet = async (e: React.MouseEvent, side: "a" | "b") => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to log in to join this wager.",
        variant: "destructive",
      });
      return;
    }

    if (!isOpen) {
      toast({
        title: "Wager closed",
        description: "This wager is no longer accepting entries.",
        variant: "destructive",
      });
      return;
    }

    if (isDeadlineElapsed(deadline)) {
      toast({
        title: "Too late",
        description: "The deadline for this wager has passed.",
        variant: "destructive",
      });
      return;
    }

    const timeRemaining = getTimeRemaining(deadline);
    if (timeRemaining > 0 && timeRemaining <= 20000) {
      toast({
        title: "Too late",
        description: "You cannot join within 20 seconds of the deadline.",
        variant: "destructive",
      });
      return;
    }

    if (userParticipated) {
      toast({
        title: "Already joined",
        description: "You have already joined this wager.",
        variant: "destructive",
      });
      return;
    }

    setJoiningSide(side);
    try {
      await wagersApi.join(id, side);
      toast({
        title: "Wager joined!",
        description: `You've wagered ${formattedAmount} on ${side === "a" ? sideA : sideB}`,
      });
      // Trigger refresh event for parent component
      window.dispatchEvent(new Event('wager-updated'));
      // Dispatch balance-updated event to refresh balance in top nav
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('balance-updated'));
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to join wager. Please try again.";
      toast({
        title: "Join failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setJoiningSide(null);
    }
  };

  // Calculate potential returns using actual amounts
  const returns = calculatePotentialReturns({
    entryAmount: amount,
    sideATotal: sideATotal || 0,
    sideBTotal: sideBTotal || 0,
    feePercentage: effectiveFeePercentage,
  });

  // Get the better return (higher potential)
  const bestReturn = Math.max(returns.sideAReturnMultiplier, returns.sideBReturnMultiplier);
  const bestReturnPercentage = Math.max(returns.sideAReturnPercentage, returns.sideBReturnPercentage);

  // Calculate probability percentages (Polymarket style)
  // Based on amounts wagered on each side
  const totalPool = (sideATotal || 0) + (sideBTotal || 0);
  const sideAPercent = totalPool > 0 ? Math.round(((sideATotal || 0) / totalPool) * 100) : 50;
  const sideBPercent = totalPool > 0 ? 100 - sideAPercent : 50;
  
  // Format volume for display
  const volumeDisplay = formatVolume(totalPool, currency as Currency);

  // Calculate total won (winnings pool) for settled bets
  const calculateTotalWon = () => {
    if (!isSettled || !winningSide) {
      return null;
    }

    const totalPool = (sideATotal || 0) + (sideBTotal || 0);
    
    if (totalPool === 0) {
      return 0;
    }
    
    const platformFee = totalPool * effectiveFeePercentage;
    const winningsPool = totalPool - platformFee;
    
    return winningsPool;
  };

  // Calculate actual winnings for settled bets
  const calculateActualWinnings = () => {
    // Only calculate if wager is settled and has a winning side
    if (!isSettled || !winningSide) {
      return null;
    }

    // If user didn't participate, return null
    if (userEntryAmount === undefined || !userEntrySide) {
      return null;
    }

    // User didn't win
    if (userEntrySide !== winningSide) {
      return 0;
    }

    // Calculate total pool (sum of all entries on both sides)
    const totalPool = (sideATotal || 0) + (sideBTotal || 0);
    
    // If no pool, return 0
    if (totalPool === 0) {
      return 0;
    }
    
    // Calculate platform fee
    const platformFee = totalPool * effectiveFeePercentage;
    
    // Calculate winnings pool (after fee)
    const winningsPool = totalPool - platformFee;
    
    // Calculate winning side total
    const winningSideTotal = winningSide === "a" ? (sideATotal || 0) : (sideBTotal || 0);
    
    // Calculate user's proportional winnings
    if (winningSideTotal > 0) {
      const userWinnings = (userEntryAmount / winningSideTotal) * winningsPool;
      return userWinnings;
    }
    
    return 0;
  };

  const actualWinnings = calculateActualWinnings();
  const totalWon = calculateTotalWon();
  const userWon = isSettled && userEntryAmount !== undefined && userEntrySide === winningSide;

  // Category icons mapping
  const categoryIcons: Record<string, string> = {
    crypto: "₿",
    finance: "📈",
    politics: "🏛️",
    sports: "⚽",
    entertainment: "🎬",
    technology: "💻",
    religion: "🙏",
    weather: "🌤️",
  };

  // Use short_id if available, otherwise fall back to UUID
  const wagerLinkId = shortId || id;

  return (
    <Link 
      href={`/wager/${wagerLinkId}`} 
      className="block group"
      onClick={onClick}
    >
      <div className="bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer active:scale-[0.99] touch-manipulation h-full flex flex-col relative overflow-hidden">
        {/* Header with category and badges */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-start justify-between gap-2 mb-2">
            {/* Category & System badge */}
            <div className="flex items-center gap-2 flex-wrap">
              {category && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{categoryIcons[category] || "📌"}</span>
                  <span className="uppercase font-medium tracking-wide">{category}</span>
                </span>
              )}
              {isSystemGenerated && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                  <Sparkles className="h-3 w-3" />
                  Official
                </span>
              )}
            </div>
            {/* Deadline indicator */}
            {deadline && isOpen && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                deadlineStatus === 'red'
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : deadlineStatus === 'orange'
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {deadlineStatus === 'red' && <Flame className="h-3 w-3" />}
                {deadlineStatus === 'orange' && <Clock className="h-3 w-3" />}
                <DeadlineDisplay deadline={deadline} size="sm" showLabel={false} className="text-[10px]" />
              </div>
            )}
            {!isOpen && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                (status === "RESOLVED" || status === "SETTLED")
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}>
                {status === "SETTLED" ? "Settled" : status === "RESOLVED" ? "Resolved" : status}
              </span>
            )}
          </div>
          
          {/* Title */}
          <h3 className="font-semibold text-foreground text-[15px] leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
        </div>

        {/* Polymarket-style outcomes with percentages */}
        <div className="px-4 py-3 flex-1">
          {isOpen && !userParticipated && user ? (
            // Interactive betting buttons with percentages
            <div className="space-y-2">
              <button
                onClick={(e) => handleQuickBet(e, "a")}
                disabled={joiningSide !== null}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all touch-manipulation ${
                  joiningSide === "a"
                    ? "bg-emerald-500/20 border border-emerald-500"
                    : "bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/30 hover:border-emerald-500/60"
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {joiningSide === "a" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm truncate">{sideA}</span>
                  )}
                </div>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">{sideAPercent}%</span>
              </button>
              <button
                onClick={(e) => handleQuickBet(e, "b")}
                disabled={joiningSide !== null}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all touch-manipulation ${
                  joiningSide === "b"
                    ? "bg-rose-500/20 border border-rose-500"
                    : "bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/30 hover:border-rose-500/60"
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {joiningSide === "b" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-rose-600 dark:text-rose-400 flex-shrink-0" />
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 font-medium text-sm truncate">{sideB}</span>
                  )}
                </div>
                <span className="text-lg font-bold text-rose-600 dark:text-rose-400 flex-shrink-0">{sideBPercent}%</span>
              </button>
            </div>
          ) : isOpen && userParticipated ? (
            // User has participated - show their position
            <div className="space-y-2">
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                userEntrySide === "a"
                  ? "bg-emerald-500/20 border-2 border-emerald-500"
                  : "bg-emerald-500/5 border border-emerald-500/20 opacity-60"
              }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`font-medium text-sm truncate ${
                    userEntrySide === "a" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  }`}>{sideA}</span>
                  {userEntrySide === "a" && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-medium flex-shrink-0">Your pick</span>
                  )}
                </div>
                <span className={`text-lg font-bold flex-shrink-0 ${
                  userEntrySide === "a" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                }`}>{sideAPercent}%</span>
              </div>
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                userEntrySide === "b"
                  ? "bg-rose-500/20 border-2 border-rose-500"
                  : "bg-rose-500/5 border border-rose-500/20 opacity-60"
              }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`font-medium text-sm truncate ${
                    userEntrySide === "b" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                  }`}>{sideB}</span>
                  {userEntrySide === "b" && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-medium flex-shrink-0">Your pick</span>
                  )}
                </div>
                <span className={`text-lg font-bold flex-shrink-0 ${
                  userEntrySide === "b" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                }`}>{sideBPercent}%</span>
              </div>
            </div>
          ) : isResolved ? (
            // Settled/Resolved - show winner
            <div className="space-y-2">
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                sideAWon 
                  ? "bg-emerald-500/20 border-2 border-emerald-500" 
                  : "bg-muted/30 border border-border opacity-60"
              }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`font-medium text-sm truncate ${
                    sideAWon ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  }`}>{sideA}</span>
                  {sideAWon && <Trophy className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                </div>
                <span className={`text-lg font-bold flex-shrink-0 ${
                  sideAWon ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                }`}>{sideAWon ? "Won" : `${sideAPercent}%`}</span>
              </div>
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                sideBWon 
                  ? "bg-emerald-500/20 border-2 border-emerald-500" 
                  : "bg-muted/30 border border-border opacity-60"
              }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`font-medium text-sm truncate ${
                    sideBWon ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  }`}>{sideB}</span>
                  {sideBWon && <Trophy className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                </div>
                <span className={`text-lg font-bold flex-shrink-0 ${
                  sideBWon ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                }`}>{sideBWon ? "Won" : `${sideBPercent}%`}</span>
              </div>
            </div>
          ) : (
            // Guest view - show percentages without interaction
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm truncate">{sideA}</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{sideAPercent}%</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20">
                <span className="text-rose-600 dark:text-rose-400 font-medium text-sm truncate">{sideB}</span>
                <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{sideBPercent}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Volume and stats (Polymarket style) */}
        <div className="px-4 py-3 bg-muted/30 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {/* Volume */}
              <span className="flex items-center gap-1 font-medium">
                <TrendingUp className="h-3.5 w-3.5" />
                ₦{volumeDisplay} Vol.
              </span>
              {/* Entry amount */}
              <span className="text-muted-foreground/70">
                {formattedAmount}/entry
              </span>
            </div>
            {/* Participants */}
            {entriesCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {entriesCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
