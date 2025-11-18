"use client";

import Link from "next/link";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, User, Users, TrendingUp, Coins, Calendar, Trophy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";
import { DeadlineDisplay } from "@/components/deadline-display";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";

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
  sideATotal?: number; // Total amount bet on side A
  sideBTotal?: number; // Total amount bet on side B
  feePercentage?: number;
  createdAt?: string;
  winningSide?: string | null;
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
  onClick,
}: WagerCardProps) {
  const isOpen = status === "OPEN";
  const isResolved = status === "RESOLVED";
  const sideAWon = isResolved && winningSide === "a";
  const sideBWon = isResolved && winningSide === "b";
  
  // Use deadline countdown hook
  const { status: deadlineStatus } = useDeadlineCountdown(deadline);
  
  const formattedAmount = formatCurrency(amount, currency as Currency);
  const isUrgent = deadline && deadlineStatus !== 'green';

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

  return (
    <Link 
      href={`/wager/${id}`} 
      className="block group"
      onClick={onClick}
    >
      <div className="bg-card border-2 border-border rounded-xl p-3 md:p-5 hover:border-primary hover:shadow-lg transition-all cursor-pointer active:scale-[0.98] touch-manipulation h-full flex flex-col relative overflow-hidden">
        {/* Status indicator bar - color based on deadline */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          !isOpen
            ? status === "RESOLVED" 
              ? "bg-blue-500" 
              : "bg-gray-400"
            : deadlineStatus === 'red'
              ? "bg-red-500"
              : deadlineStatus === 'orange'
              ? "bg-orange-500"
              : "bg-green-500"
        }`} />

        {/* Header */}
        <div className="flex justify-between items-start mb-2.5 md:mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <h3 className="font-bold text-foreground flex-1 text-sm md:text-lg line-clamp-2 leading-tight group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
            {isSystemGenerated ? (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-3 w-3" />
                <span className="text-[9px] font-medium hidden sm:inline">Auto</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="text-[9px] font-medium hidden sm:inline">User</span>
              </div>
            )}
            <span
              className={`text-[9px] md:text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                isOpen
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : status === "RESOLVED"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Category badge */}
        {category && (
          <div className="mb-2 flex items-center gap-1">
            <span className="text-base">{categoryIcons[category] || "📌"}</span>
            <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-medium">
              {category}
            </span>
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-[10px] md:text-sm text-muted-foreground mb-3 md:mb-4 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* Sides - Improved visual design with winner indication */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4 flex-shrink-0 bg-muted/30 rounded-lg p-2 md:p-2.5">
          <div className={`text-center relative rounded-lg p-1.5 md:p-2 transition-all ${
            sideAWon 
              ? "bg-green-500/20 border-2 border-green-500 dark:bg-green-500/10" 
              : sideBWon
              ? "bg-gray-500/10 border border-border opacity-60"
              : "border border-transparent"
          }`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <div className="text-[9px] md:text-[10px] text-muted-foreground font-medium">Side A</div>
              {sideAWon && (
                <Trophy className="h-3 w-3 md:h-4 md:w-4 text-green-600 dark:text-green-400" />
              )}
            </div>
            <p className={`font-bold text-xs md:text-sm truncate px-1 ${
              sideAWon 
                ? "text-green-700 dark:text-green-400" 
                : sideBWon
                ? "text-muted-foreground"
                : "text-foreground"
            }`}>{sideA}</p>
            {sideAWon && (
              <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                <CheckCircle2 className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          <div className={`text-center border-l border-border relative rounded-lg p-1.5 md:p-2 transition-all ${
            sideBWon 
              ? "bg-green-500/20 border-2 border-green-500 dark:bg-green-500/10 ml-[-1px]" 
              : sideAWon
              ? "bg-gray-500/10 border border-border opacity-60"
              : "border border-transparent"
          }`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <div className="text-[9px] md:text-[10px] text-muted-foreground font-medium">Side B</div>
              {sideBWon && (
                <Trophy className="h-3 w-3 md:h-4 md:w-4 text-green-600 dark:text-green-400" />
              )}
            </div>
            <p className={`font-bold text-xs md:text-sm truncate px-1 ${
              sideBWon 
                ? "text-green-700 dark:text-green-400" 
                : sideAWon
                ? "text-muted-foreground"
                : "text-foreground"
            }`}>{sideB}</p>
            {sideBWon && (
              <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                <CheckCircle2 className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Footer - Enhanced with icons */}
        <div className="mt-auto pt-2.5 md:pt-3 border-t border-border space-y-1.5 md:space-y-2">
          {/* Entry amount - prominent */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
              <span className="text-[10px] md:text-xs text-muted-foreground">Entry Amount</span>
            </div>
            <span className="font-bold text-foreground text-sm md:text-base">{formattedAmount}</span>
          </div>

          {/* Potential Return - New Feature */}
          {isOpen && entriesCount > 0 && (
            <div className="flex items-center justify-between bg-primary/5 rounded-lg p-2 border border-primary/20">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                <span className="text-[9px] md:text-[10px] text-muted-foreground">Potential Return</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-primary text-xs md:text-sm">
                  {formatReturnMultiplier(bestReturn)}
                </span>
                <span className="text-[9px] md:text-[10px] text-green-600 dark:text-green-400 ml-1.5">
                  {formatReturnPercentage(bestReturnPercentage)}
                </span>
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center justify-between text-[9px] md:text-[10px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="font-medium">{entriesCount} {entriesCount === 1 ? 'participant' : 'participants'}</span>
            </div>
            {deadline && (
              <DeadlineDisplay 
                deadline={deadline} 
                size="sm"
                showLabel={false}
                className="font-medium"
              />
            )}
          </div>

          {/* Created date */}
          {createdAt && (
            <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-muted-foreground mt-1">
              <Calendar className="h-3 w-3" />
              <span>Created {format(new Date(createdAt), "MMM d, yyyy")}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
