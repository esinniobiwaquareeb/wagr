"use client";

import Link from "next/link";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, User, Users, TrendingUp, Coins, Calendar, Trophy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";
import { DeadlineDisplay } from "@/components/deadline-display";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";

interface WagerRowProps {
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
  sideATotal?: number;
  sideBTotal?: number;
  feePercentage?: number;
  createdAt?: string;
  winningSide?: string | null;
  shortId?: string | null;
  userEntryAmount?: number;
  userEntrySide?: string;
  onClick?: () => void;
}

export function WagerRow({
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
}: WagerRowProps) {
  const isOpen = status === "OPEN";
  const isResolved = status === "RESOLVED" || status === "SETTLED";
  const isSettled = status === "SETTLED";
  const sideAWon = isResolved && winningSide === "a";
  const sideBWon = isResolved && winningSide === "b";
  
  const { status: deadlineStatus } = useDeadlineCountdown(deadline);
  
  const formattedAmount = formatCurrency(amount, currency as Currency);
  const isUrgent = deadline && deadlineStatus !== 'green';

  const returns = calculatePotentialReturns({
    entryAmount: amount,
    sideATotal: sideATotal || 0,
    sideBTotal: sideBTotal || 0,
    feePercentage: feePercentage || PLATFORM_FEE_PERCENTAGE,
  });

  const bestReturn = Math.max(returns.sideAReturnMultiplier, returns.sideBReturnMultiplier);
  const bestReturnPercentage = Math.max(returns.sideAReturnPercentage, returns.sideBReturnPercentage);

  const wagerLinkId = shortId || id;

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

  return (
    <Link 
      href={`/wager/${wagerLinkId}`} 
      className="block group"
      onClick={onClick}
    >
      <div className="bg-card border border-border rounded-lg p-3 md:p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer active:scale-[0.99] touch-manipulation">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          {/* Left: Title and Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1.5">
              <h3 className="font-semibold text-sm md:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors flex-1">
                {title}
              </h3>
              {isSystemGenerated ? (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                  <Sparkles className="h-3 w-3" />
                </div>
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                  <User className="h-3 w-3" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {category && (
                <span className="flex items-center gap-1">
                  <span>{categoryIcons[category] || "📌"}</span>
                  <span className="uppercase">{category}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {entriesCount} {entriesCount === 1 ? 'entry' : 'entries'}
              </span>
              <span className="flex items-center gap-1">
                <Coins className="h-3 w-3" />
                {formattedAmount}
              </span>
            </div>
          </div>

          {/* Middle: Sides */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <div className={`text-center px-2 py-1 rounded border text-xs ${
              sideAWon 
                ? "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400" 
                : sideBWon
                ? "bg-muted/50 border-border text-muted-foreground opacity-60"
                : "border-border"
            }`}>
              <div className="font-medium truncate max-w-[80px] md:max-w-[120px]">{sideA}</div>
              {sideAWon && <Trophy className="h-3 w-3 mx-auto mt-0.5" />}
            </div>
            <span className="text-muted-foreground text-xs">vs</span>
            <div className={`text-center px-2 py-1 rounded border text-xs ${
              sideBWon 
                ? "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400" 
                : sideAWon
                ? "bg-muted/50 border-border text-muted-foreground opacity-60"
                : "border-border"
            }`}>
              <div className="font-medium truncate max-w-[80px] md:max-w-[120px]">{sideB}</div>
              {sideBWon && <Trophy className="h-3 w-3 mx-auto mt-0.5" />}
            </div>
          </div>

          {/* Right: Stats and Deadline */}
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
            {isOpen && bestReturn > 0 && (
              <div className="hidden md:flex flex-col items-end text-xs">
                <span className="text-muted-foreground">Best Return</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatReturnPercentage(bestReturnPercentage)}%
                </span>
              </div>
            )}
            {deadline && (
              <div className="flex flex-col items-end text-xs">
                <DeadlineDisplay deadline={deadline} size="sm" showLabel={false} />
              </div>
            )}
            <span className={`text-xs px-2 py-1 rounded ${
              isOpen
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : (status === "RESOLVED" || status === "SETTLED")
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}>
              {status === "SETTLED" ? "Settled" : status === "RESOLVED" ? "Resolved" : status}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

