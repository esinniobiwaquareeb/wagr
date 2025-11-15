"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, User } from "lucide-react";

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
  onClick,
}: WagerCardProps) {
  const isOpen = status === "OPEN";
  const timeLeft = deadline ? formatDistanceToNow(new Date(deadline), { addSuffix: true }) : "No deadline";
  const formattedAmount = formatCurrency(amount, currency as Currency);

  return (
    <Link 
      href={`/wager/${id}`} 
      className="block"
      onClick={onClick}
    >
      <div className="bg-card border border-border rounded-lg p-3 md:p-5 hover:border-primary hover:shadow-md transition-all cursor-pointer active:scale-[0.98] touch-manipulation h-full flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-start gap-1.5 md:gap-2 flex-1 min-w-0">
            <h3 className="font-semibold text-foreground flex-1 text-xs md:text-base line-clamp-2">{title}</h3>
            {isSystemGenerated ? (
              <div className="flex-shrink-0 flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-2.5 w-2.5 md:h-3 md:w-3" />
                <span className="text-[9px] md:text-[10px] font-medium hidden sm:inline">Auto</span>
              </div>
            ) : (
              <div className="flex-shrink-0 flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md bg-muted text-muted-foreground">
                <User className="h-2.5 w-2.5 md:h-3 md:w-3" />
                <span className="text-[9px] md:text-[10px] font-medium hidden sm:inline">User</span>
              </div>
            )}
          </div>
          <span
            className={`text-[9px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full flex-shrink-0 ml-1.5 md:ml-2 font-medium ${
              isOpen
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            }`}
          >
            {status}
          </span>
        </div>

        {description && (
          <p className="text-[10px] md:text-sm text-muted-foreground mb-2 md:mb-3 line-clamp-2 flex-shrink-0">
            {description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-1.5 md:gap-2 mb-2 md:mb-3 flex-shrink-0">
          <div className="text-[10px] md:text-xs">
            <span className="text-muted-foreground">Side A</span>
            <p className="font-medium text-foreground text-[10px] md:text-sm truncate">{sideA}</p>
          </div>
          <div className="text-[10px] md:text-xs">
            <span className="text-muted-foreground">Side B</span>
            <p className="font-medium text-foreground text-[10px] md:text-sm truncate">{sideB}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 md:gap-2 text-[10px] md:text-sm mt-auto pt-1.5 md:pt-2 border-t border-border">
          <div>
            <span className="text-muted-foreground">Entry: </span>
            <span className="font-semibold text-foreground">{formattedAmount}</span>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-muted-foreground">{entriesCount} joined</span>
            <br />
            <span className="text-xs text-muted-foreground">{timeLeft}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
