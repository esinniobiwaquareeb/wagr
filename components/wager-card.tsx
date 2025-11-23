"use client";

import Link from "next/link";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, User, Users, TrendingUp, Coins, Calendar, Trophy, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";
import { DeadlineDisplay } from "@/components/deadline-display";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";
import { wagersApi } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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
  const [joiningSide, setJoiningSide] = useState<"a" | "b" | null>(null);
  
  const isOpen = status === "OPEN";
  const isResolved = status === "RESOLVED" || status === "SETTLED";
  const isSettled = status === "SETTLED";
  const sideAWon = isResolved && winningSide === "a";
  const sideBWon = isResolved && winningSide === "b";
  const userParticipated = userEntryAmount !== undefined && userEntrySide !== undefined;
  
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
    feePercentage: feePercentage || PLATFORM_FEE_PERCENTAGE,
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
    
    const platformFee = totalPool * (feePercentage || PLATFORM_FEE_PERCENTAGE);
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
    const platformFee = totalPool * (feePercentage || PLATFORM_FEE_PERCENTAGE);
    
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
      <div className="bg-card border border-border rounded-lg p-3 hover:border-primary hover:shadow-md transition-all cursor-pointer active:scale-[0.98] touch-manipulation h-full flex flex-col relative overflow-hidden">
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

        {/* Header */}
        <div className="flex justify-between items-start mb-1.5">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <h3 className="font-semibold text-foreground flex-1 text-xs md:text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {isSystemGenerated ? (
              <Sparkles className="h-3 w-3 text-primary" />
            ) : (
              <User className="h-3 w-3 text-muted-foreground" />
            )}
            <span
              className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${
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

        {/* Category badge - compact */}
        {category && (
          <div className="mb-1.5 flex items-center gap-1">
            <span className="text-xs">{categoryIcons[category] || "📌"}</span>
            <span className="text-[8px] text-muted-foreground uppercase font-medium">
              {category}
            </span>
          </div>
        )}

        {/* Description - single line */}
        {description && (
          <p className="text-[9px] text-muted-foreground mb-2 line-clamp-1 leading-tight">
            {description}
          </p>
        )}

        {/* Sides - Compact design with quick wager buttons */}
        <div className="grid grid-cols-2 gap-1.5 mb-2 flex-shrink-0">
          {isOpen && !userParticipated && user ? (
            // Quick wager buttons for open wagers
            <>
              <button
                key={`bet-a-${id}`}
                onClick={(e) => handleQuickBet(e, "a")}
                disabled={joiningSide !== null}
                className={`relative rounded-lg p-2.5 min-h-[44px] transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  joiningSide === "a"
                    ? "bg-primary/20 border-2 border-primary"
                    : "bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary"
                } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
              >
                {joiningSide === "a" ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[10px] font-semibold text-primary">Joining...</span>
                  </div>
                ) : (
                  <>
                    <p className="font-bold text-[11px] text-primary mb-0.5">{sideA}</p>
                    <p className="text-[8px] text-muted-foreground">Click to wager</p>
                  </>
                )}
              </button>
              <button
                key={`bet-b-${id}`}
                onClick={(e) => handleQuickBet(e, "b")}
                disabled={joiningSide !== null}
                className={`relative rounded-lg p-2.5 min-h-[44px] transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  joiningSide === "b"
                    ? "bg-primary/20 border-2 border-primary"
                    : "bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary"
                } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
              >
                {joiningSide === "b" ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[10px] font-semibold text-primary">Joining...</span>
                  </div>
                ) : (
                  <>
                    <p className="font-bold text-[11px] text-primary mb-0.5">{sideB}</p>
                    <p className="text-[8px] text-muted-foreground">Click to wager</p>
                  </>
                )}
              </button>
            </>
          ) : (
            // Display only for settled/resolved or if user already participated
            <div className="grid grid-cols-2 gap-1.5 bg-muted/20 rounded p-1.5 col-span-2">
              <div className={`text-center relative rounded p-1 transition-all ${
                sideAWon 
                  ? "bg-green-500/20 border border-green-500" 
                  : sideBWon
                  ? "opacity-60"
                  : userParticipated && userEntrySide === "a"
                  ? "bg-primary/10 border border-primary/30"
                  : ""
              }`}>
                <p className={`font-semibold text-[10px] truncate ${
                  sideAWon 
                    ? "text-green-700 dark:text-green-400" 
                    : sideBWon
                    ? "text-muted-foreground"
                    : userParticipated && userEntrySide === "a"
                    ? "text-primary"
                    : "text-foreground"
                }`}>{sideA}</p>
                {sideAWon && (
                  <Trophy className="h-2.5 w-2.5 text-green-600 dark:text-green-400 mx-auto mt-0.5" />
                )}
                {userParticipated && userEntrySide === "a" && !sideAWon && !sideBWon && (
                  <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                    <CheckCircle2 className="h-2 w-2 text-white" />
                  </div>
                )}
              </div>
              <div className={`text-center border-l border-border relative rounded p-1 transition-all ${
                sideBWon 
                  ? "bg-green-500/20 border border-green-500 ml-[-1px]" 
                  : sideAWon
                  ? "opacity-60"
                  : userParticipated && userEntrySide === "b"
                  ? "bg-primary/10 border border-primary/30"
                  : ""
              }`}>
                <p className={`font-semibold text-[10px] truncate ${
                  sideBWon 
                    ? "text-green-700 dark:text-green-400" 
                    : sideAWon
                    ? "text-muted-foreground"
                    : userParticipated && userEntrySide === "b"
                    ? "text-primary"
                    : "text-foreground"
                }`}>{sideB}</p>
                {sideBWon && (
                  <Trophy className="h-2.5 w-2.5 text-green-600 dark:text-green-400 mx-auto mt-0.5" />
                )}
                {userParticipated && userEntrySide === "b" && !sideAWon && !sideBWon && (
                  <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                    <CheckCircle2 className="h-2 w-2 text-white" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Compact with all info */}
        <div className="mt-auto pt-2 border-t border-border space-y-1.5">
          {/* Top row: Entry amount, Potential return, Participants */}
          <div className="flex items-center justify-between text-[9px]">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">{formattedAmount}</span>
              {isOpen && entriesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  {formatReturnMultiplier(bestReturn)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {entriesCount > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  <Users className="h-2.5 w-2.5" />
                  <span className="font-medium">{entriesCount}</span>
                </span>
              )}
              {deadline && (
                <DeadlineDisplay 
                  deadline={deadline} 
                  size="sm"
                  showLabel={false}
                  className="text-[9px]"
                />
              )}
            </div>
          </div>

          {/* Bottom row: Potential winnings, Date created */}
          <div className="flex items-center justify-between text-[8px]">
            {isOpen && entriesCount > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400">
                <Coins className="h-2.5 w-2.5" />
                <span className="font-semibold">
                  {formatCurrency(Math.max(returns.sideAPotential, returns.sideBPotential), currency as Currency)}
                </span>
              </div>
            )}
            {createdAt && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                <span>{format(new Date(createdAt), "MMM d")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
