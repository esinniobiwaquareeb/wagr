"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";

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
      <div className="bg-card border border-border rounded-lg p-4 md:p-5 hover:border-primary transition cursor-pointer active:scale-[0.98] touch-manipulation h-full">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-foreground flex-1 text-sm md:text-base line-clamp-2">{title}</h3>
          <span
            className={`text-xs px-2 py-1 rounded flex-shrink-0 ml-2 ${
              isOpen
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            }`}
          >
            {status}
          </span>
        </div>

        {description && (
          <p className="text-xs md:text-sm text-muted-foreground mb-3 line-clamp-2">
            {description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="text-xs">
            <span className="text-muted-foreground">Side A</span>
            <p className="font-medium text-foreground text-xs md:text-sm truncate">{sideA}</p>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Side B</span>
            <p className="font-medium text-foreground text-xs md:text-sm truncate">{sideB}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs md:text-sm">
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
