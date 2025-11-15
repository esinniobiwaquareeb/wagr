"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, User, Users, Clock, TrendingUp } from "lucide-react";

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
  onClick,
}: WagerCardProps) {
  const isOpen = status === "OPEN";
  const timeLeft = deadline ? formatDistanceToNow(new Date(deadline), { addSuffix: true }) : null;
  const formattedAmount = formatCurrency(amount, currency as Currency);
  const isUrgent = deadline && new Date(deadline).getTime() - Date.now() < 24 * 60 * 60 * 1000; // Less than 24 hours

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
        {/* Status indicator bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          isOpen 
            ? "bg-green-500" 
            : status === "RESOLVED" 
            ? "bg-blue-500" 
            : "bg-gray-400"
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

        {/* Sides - Improved visual design */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4 flex-shrink-0 bg-muted/30 rounded-lg p-2 md:p-2.5">
          <div className="text-center">
            <div className="text-[9px] md:text-[10px] text-muted-foreground mb-1 font-medium">Side A</div>
            <p className="font-bold text-foreground text-xs md:text-sm truncate px-1">{sideA}</p>
          </div>
          <div className="text-center border-l border-border">
            <div className="text-[9px] md:text-[10px] text-muted-foreground mb-1 font-medium">Side B</div>
            <p className="font-bold text-foreground text-xs md:text-sm truncate px-1">{sideB}</p>
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

          {/* Stats row */}
          <div className="flex items-center justify-between text-[9px] md:text-[10px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="font-medium">{entriesCount} {entriesCount === 1 ? 'participant' : 'participants'}</span>
            </div>
            {timeLeft && (
              <div className={`flex items-center gap-1.5 font-medium ${
                isUrgent ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
              }`}>
                <Clock className={`h-3 w-3 md:h-3.5 md:w-3.5 ${isUrgent ? 'animate-pulse' : ''}`} />
                <span>{timeLeft}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
