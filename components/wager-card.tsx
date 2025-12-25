"use client";

import Link from "next/link";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, User, Users, TrendingUp, Coins, Calendar, Trophy, CheckCircle2, Loader2, Check, X } from "lucide-react";
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
      <div className="bg-card border border-border rounded-lg p-3 sm:p-2.5 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer active:scale-[0.99] touch-manipulation h-full flex flex-col relative overflow-hidden">
        {/* Status indicator bar - color based on deadline */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${
          !isOpen
            ? (status === "RESOLVED" || status === "SETTLED")
              ? "bg-blue-500" 
              : "bg-gray-400"
            : deadlineStatus === 'red'
              ? "bg-red-500"
              : deadlineStatus === 'orange'
              ? "bg-orange-500"
              : "bg-green-500"
        }`} />

        {/* Header - Responsive */}
        <div className="flex items-start justify-between gap-2 mb-2 sm:mb-1.5">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm sm:text-xs leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1 sm:mb-0.5">
              {title}
            </h3>
            {category && (
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-[10px]">{categoryIcons[category] || "📌"}</span>
                  <span className="text-[10px] sm:text-[9px] text-muted-foreground uppercase font-medium">
                    {category}
                  </span>
                </div>
                {createdAt && (
                  <div className="flex items-center gap-1 sm:gap-0.5 text-muted-foreground text-[9px] sm:text-[8px] whitespace-nowrap">
                    <Calendar className="h-3 w-3 sm:h-2.5 sm:w-2.5" />
                    <span>{format(new Date(createdAt), "MMM d")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-1 flex-shrink-0">
            {isSystemGenerated ? (
              <Sparkles className="h-4 w-4 sm:h-3 sm:w-3 text-primary" />
            ) : (
              <User className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground" />
            )}
            <span
              className={`text-[10px] sm:text-[9px] px-2 py-1 sm:px-1.5 sm:py-0.5 rounded font-medium whitespace-nowrap ${
                isOpen
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : (status === "RESOLVED" || status === "SETTLED")
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {status === "SETTLED" ? "Settled" : status === "RESOLVED" ? "Resolved" : status}
            </span>
          </div>
        </div>

        {/* Sides - Responsive design with quick wager buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-1.5 mb-2 sm:mb-1.5 flex-shrink-0">
          {isOpen && !userParticipated && user ? (
            // Quick wager buttons for authenticated users who haven't participated - Touch-friendly on mobile
            <>
              {/* Side A (Yes) - Blue with Check icon */}
              <button
                key={`bet-a-${id}`}
                onClick={(e) => handleQuickBet(e, "a")}
                disabled={joiningSide !== null}
                className={`relative rounded-md p-2.5 sm:p-2 min-h-[48px] sm:min-h-[40px] transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  joiningSide === "a"
                    ? "bg-blue-500/20 border border-blue-500"
                    : "bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 hover:border-blue-500"
                } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
                aria-label={`Wager on ${sideA}`}
              >
                {joiningSide === "a" ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 sm:h-3 sm:w-3 animate-spin text-blue-600 dark:text-blue-400" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 sm:gap-1">
                    <Check className="h-4 w-4 sm:h-3 sm:w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" strokeWidth={3} />
                    <p className="font-semibold text-xs sm:text-[10px] text-blue-600 dark:text-blue-400 leading-tight line-clamp-2 text-center">{sideA}</p>
                  </div>
                )}
              </button>
              {/* Side B (No) - Orange with X icon */}
              <button
                key={`bet-b-${id}`}
                onClick={(e) => handleQuickBet(e, "b")}
                disabled={joiningSide !== null}
                className={`relative rounded-md p-2.5 sm:p-2 min-h-[48px] sm:min-h-[40px] transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                  joiningSide === "b"
                    ? "bg-orange-500/20 border border-orange-500"
                    : "bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/40 hover:border-orange-500"
                } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
                aria-label={`Wager on ${sideB}`}
              >
                {joiningSide === "b" ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 sm:h-3 sm:w-3 animate-spin text-orange-600 dark:text-orange-400" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 sm:gap-1">
                    <X className="h-4 w-4 sm:h-3 sm:w-3 text-orange-600 dark:text-orange-400 flex-shrink-0" strokeWidth={3} />
                    <p className="font-semibold text-xs sm:text-[10px] text-orange-600 dark:text-orange-400 leading-tight line-clamp-2 text-center">{sideB}</p>
                  </div>
                )}
              </button>
            </>
          ) : isOpen && !user ? (
            // Display for unauthenticated users viewing open wagers - Show sides clearly
            <div className="grid grid-cols-2 gap-1.5 sm:gap-1 bg-muted/20 rounded-md p-2 sm:p-1.5 col-span-2">
              <div className="text-center relative rounded p-1.5 sm:p-1 bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center justify-center gap-1 sm:gap-0.5 mb-0.5">
                  <Check className="h-3 w-3 sm:h-2.5 sm:w-2.5 text-blue-600 dark:text-blue-400 flex-shrink-0" strokeWidth={3} />
                </div>
                <p className="font-semibold text-xs sm:text-[10px] text-blue-600 dark:text-blue-400 truncate">{sideA}</p>
              </div>
              <div className="text-center border-l border-border relative rounded p-1.5 sm:p-1 bg-orange-500/5 border border-orange-500/20 ml-[-1px]">
                <div className="flex items-center justify-center gap-1 sm:gap-0.5 mb-0.5">
                  <X className="h-3 w-3 sm:h-2.5 sm:w-2.5 text-orange-600 dark:text-orange-400 flex-shrink-0" strokeWidth={3} />
                </div>
                <p className="font-semibold text-xs sm:text-[10px] text-orange-600 dark:text-orange-400 truncate">{sideB}</p>
              </div>
            </div>
          ) : isOpen && userParticipated && user ? (
            // Display for authenticated users who have participated in open wagers - Highlight their selection
            <div className="grid grid-cols-2 gap-1.5 sm:gap-1 bg-muted/20 rounded-md p-2 sm:p-1.5 col-span-2">
              <div className={`text-center relative rounded p-1.5 sm:p-1 transition-all ${
                userEntrySide === "a"
                  ? "bg-primary/10 border-2 border-primary/50 shadow-md shadow-primary/10"
                  : "bg-blue-500/5 border border-blue-500/20"
              }`}>
                <div className="flex items-center justify-center gap-1 sm:gap-0.5 mb-0.5">
                  <Check className={`h-3 w-3 sm:h-2.5 sm:w-2.5 flex-shrink-0 ${
                    userEntrySide === "a"
                      ? "text-primary"
                      : "text-blue-600 dark:text-blue-400"
                  }`} strokeWidth={3} />
                </div>
                <p className={`font-semibold text-xs sm:text-[10px] truncate ${
                  userEntrySide === "a"
                    ? "text-primary"
                    : "text-blue-600 dark:text-blue-400"
                }`}>{sideA}</p>
                {userEntrySide === "a" && (
                  <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5 shadow-sm">
                    <CheckCircle2 className="h-2 w-2 text-white" />
                  </div>
                )}
              </div>
              <div className={`text-center border-l border-border relative rounded p-1.5 sm:p-1 transition-all ml-[-1px] ${
                userEntrySide === "b"
                  ? "bg-primary/10 border-2 border-primary/50 shadow-md shadow-primary/10"
                  : "bg-orange-500/5 border border-orange-500/20"
              }`}>
                <div className="flex items-center justify-center gap-1 sm:gap-0.5 mb-0.5">
                  <X className={`h-3 w-3 sm:h-2.5 sm:w-2.5 flex-shrink-0 ${
                    userEntrySide === "b"
                      ? "text-primary"
                      : "text-orange-600 dark:text-orange-400"
                  }`} strokeWidth={3} />
                </div>
                <p className={`font-semibold text-xs sm:text-[10px] truncate ${
                  userEntrySide === "b"
                    ? "text-primary"
                    : "text-orange-600 dark:text-orange-400"
                }`}>{sideB}</p>
                {userEntrySide === "b" && (
                  <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5 shadow-sm">
                    <CheckCircle2 className="h-2 w-2 text-white" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Display for settled/resolved wagers
            <div className="grid grid-cols-2 gap-1.5 sm:gap-1 bg-muted/30 rounded-md p-2 sm:p-1.5 col-span-2">
              <div className={`text-center relative rounded p-1.5 sm:p-1 transition-all ${
                sideAWon 
                  ? "bg-green-500/20 border border-green-500" 
                  : sideBWon
                  ? "opacity-60"
                  : userParticipated && userEntrySide === "a"
                  ? "bg-primary/10 border border-primary/30"
                  : ""
              }`}>
                <p className={`font-semibold text-xs sm:text-[10px] truncate ${
                  sideAWon 
                    ? "text-green-700 dark:text-green-400" 
                    : sideBWon
                    ? "text-muted-foreground"
                    : userParticipated && userEntrySide === "a"
                    ? "text-primary"
                    : "text-foreground"
                }`}>{sideA}</p>
                {sideAWon && (
                  <Trophy className="h-3 w-3 sm:h-2.5 sm:w-2.5 text-green-600 dark:text-green-400 mx-auto mt-0.5" />
                )}
                {userParticipated && userEntrySide === "a" && !sideAWon && !sideBWon && (
                  <div className="absolute -top-0.5 -right-0.5 bg-primary rounded-full p-0.5">
                    <CheckCircle2 className="h-1.5 w-1.5 text-white" />
                  </div>
                )}
              </div>
              <div className={`text-center border-l border-border relative rounded p-1.5 sm:p-1 transition-all ${
                sideBWon 
                  ? "bg-green-500/20 border border-green-500 ml-[-1px]" 
                  : sideAWon
                  ? "opacity-60"
                  : userParticipated && userEntrySide === "b"
                  ? "bg-primary/10 border border-primary/30"
                  : ""
              }`}>
                <p className={`font-semibold text-xs sm:text-[10px] truncate ${
                  sideBWon 
                    ? "text-green-700 dark:text-green-400" 
                    : sideAWon
                    ? "text-muted-foreground"
                    : userParticipated && userEntrySide === "b"
                    ? "text-primary"
                    : "text-foreground"
                }`}>{sideB}</p>
                {sideBWon && (
                  <Trophy className="h-3 w-3 sm:h-2.5 sm:w-2.5 text-green-600 dark:text-green-400 mx-auto mt-0.5" />
                )}
                {userParticipated && userEntrySide === "b" && !sideAWon && !sideBWon && (
                  <div className="absolute -top-0.5 -right-0.5 bg-primary rounded-full p-0.5">
                    <CheckCircle2 className="h-1.5 w-1.5 text-white" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Responsive layout */}
        <div className="mt-auto pt-2 sm:pt-1.5 border-t border-border/50 space-y-1.5 sm:space-y-1">
          {/* First row: Amount, returns, participants, potential winnings, deadline */}
          <div className="flex items-center justify-between gap-2 sm:gap-1.5 flex-wrap text-[10px] sm:text-[9px]">
            <div className="flex items-center gap-2 sm:gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground whitespace-nowrap">{formattedAmount}</span>
              {isOpen && entriesCount > 0 && (
                <>
                  <span className="px-1.5 py-0.5 sm:px-1 sm:py-0.5 rounded bg-primary/10 text-primary font-medium text-[9px] sm:text-[8px] whitespace-nowrap">
                    {formatReturnMultiplier(bestReturn)}
                  </span>
                  <span className="flex items-center gap-1 sm:gap-0.5 px-1.5 py-0.5 sm:px-1 sm:py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
                    <Users className="h-3 w-3 sm:h-2.5 sm:w-2.5" />
                    <span className="font-medium">{entriesCount}</span>
                  </span>
                </>
              )}
              {isOpen && entriesCount > 0 && (
                <span className="px-1.5 py-0.5 sm:px-1 sm:py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400 text-[9px] sm:text-[8px] whitespace-nowrap">
                  <Coins className="h-3 w-3 sm:h-2.5 sm:w-2.5 inline mr-0.5" />
                  {formatCurrency(Math.max(returns.sideAPotential, returns.sideBPotential), currency as Currency)}
                </span>
              )}
            </div>
            {deadline && (
              <div className="flex-shrink-0">
                <DeadlineDisplay 
                  deadline={deadline} 
                  size="sm"
                  showLabel={false}
                  className="text-[10px] sm:text-[9px]"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
