"use client";

import Link from "next/link";
import { memo, useCallback, useMemo, useState } from "react";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, Users, TrendingUp, Trophy, Loader2, Clock } from "lucide-react";
import { wagersApi } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { isDeadlineElapsed, getTimeRemaining } from "@/lib/deadline-utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface WagerCardProps {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  amount: number;
  status: string;
  entriesCount: number;
  deadline: string;
  currency?: string;
  isSystemGenerated?: boolean;
  category?: string;
  sideATotal?: number;
  sideBTotal?: number;
  winningSide?: string | null;
  shortId?: string | null;
  userEntrySide?: string;
}

// Memoized helper for volume formatting
const formatVol = (amount: number): string => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return String(Math.round(amount));
};

// Memoized time remaining display
const getTimeDisplay = (deadline: string): { text: string; urgent: boolean } => {
  const remaining = getTimeRemaining(deadline);
  if (remaining <= 0) return { text: "Ended", urgent: false };
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return { text: `${days}d`, urgent: false };
  }
  if (hours > 0) return { text: `${hours}h`, urgent: hours < 2 };
  return { text: `${minutes}m`, urgent: true };
};

const WagerCardComponent = ({
  id,
  title,
  sideA,
  sideB,
  amount,
  status,
  entriesCount,
  deadline,
  currency = DEFAULT_CURRENCY,
  isSystemGenerated = false,
  category,
  sideATotal = 0,
  sideBTotal = 0,
  winningSide,
  shortId,
  userEntrySide,
}: WagerCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [joining, setJoining] = useState<"a" | "b" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);

  // Memoized calculations
  const { pool, pctA, pctB, vol } = useMemo(() => {
    const total = sideATotal + sideBTotal;
    return {
      pool: total,
      pctA: total > 0 ? Math.round((sideATotal / total) * 100) : 50,
      pctB: total > 0 ? Math.round((sideBTotal / total) * 100) : 50,
      vol: formatVol(total),
    };
  }, [sideATotal, sideBTotal]);

  const timeInfo = useMemo(() => deadline ? getTimeDisplay(deadline) : null, [deadline]);
  const isOpen = status === "OPEN";
  const isSettled = status === "SETTLED" || status === "RESOLVED";
  const userPicked = userEntrySide === "a" || userEntrySide === "b";
  const canBet = isOpen && user && !userPicked && !isDeadlineElapsed(deadline);

  // Handle click to show confirmation dialog
  const handleBetClick = useCallback((e: React.MouseEvent, side: "a" | "b") => {
    e.preventDefault();
    e.stopPropagation();

    if (!canBet || joining) return;

    const remaining = getTimeRemaining(deadline);
    if (remaining > 0 && remaining <= 20000) {
      toast({ title: "Too late", description: "Cannot bet within 20s of deadline.", variant: "destructive" });
      return;
    }

    // Show confirmation dialog
    setSelectedSide(side);
    setShowConfirmDialog(true);
  }, [canBet, joining, deadline, toast]);

  // Confirm and execute the bet
  const confirmBet = useCallback(async () => {
    if (!selectedSide || joining) return;

    setJoining(selectedSide);
    setShowConfirmDialog(false);
    
    try {
      await wagersApi.join(id, selectedSide);
      toast({ title: "Joined!", description: `You bet on ${selectedSide === "a" ? sideA : sideB}` });
      window.dispatchEvent(new Event('wager-updated'));
      window.dispatchEvent(new CustomEvent('balance-updated'));
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message || "Could not join.", variant: "destructive" });
    } finally {
      setJoining(null);
      setSelectedSide(null);
    }
  }, [selectedSide, joining, id, sideA, sideB, toast]);

  const linkId = shortId || id;

  return (
    <>
      <Link href={`/wager/${linkId}`} className="block group" prefetch={false}>
        <article className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 h-full flex flex-col">
        {/* Compact Header */}
        <header className="px-3.5 pt-3.5 pb-2">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              {isSystemGenerated && (
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              )}
              {category && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </span>
              )}
            </div>
            {isOpen && timeInfo && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                timeInfo.urgent 
                  ? "bg-red-500/10 text-red-600 dark:text-red-400" 
                  : "bg-muted text-muted-foreground"
              }`}>
                <Clock className="h-3 w-3 inline mr-0.5 -mt-0.5" />
                {timeInfo.text}
              </span>
            )}
            {isSettled && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {status === "SETTLED" ? "Settled" : "Resolved"}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
        </header>

        {/* Outcomes - Ultra Compact */}
        <div className="px-3.5 py-2.5 flex-1 space-y-1.5">
          {/* Option A */}
          {canBet ? (
            <button
              onClick={(e) => handleBetClick(e, "a")}
              disabled={!!joining}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500/8 to-emerald-500/4 border border-emerald-500/25 hover:border-emerald-500/50 hover:from-emerald-500/12 hover:to-emerald-500/8 transition-all disabled:opacity-50"
            >
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 truncate pr-2">
                {joining === "a" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : sideA}
              </span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{pctA}%</span>
            </button>
          ) : (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
              isSettled && winningSide === "a"
                ? "bg-emerald-500/15 border-2 border-emerald-500/60"
                : userEntrySide === "a"
                ? "bg-primary/10 border-2 border-primary/50"
                : "bg-muted/40 border border-border/50"
            }`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-sm font-medium truncate ${
                  isSettled && winningSide === "a" ? "text-emerald-700 dark:text-emerald-400" :
                  userEntrySide === "a" ? "text-primary" : "text-muted-foreground"
                }`}>{sideA}</span>
                {isSettled && winningSide === "a" && <Trophy className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                {userEntrySide === "a" && isOpen && <span className="text-[9px] bg-primary text-white px-1 rounded">YOU</span>}
              </div>
              <span className={`text-base font-bold tabular-nums ${
                isSettled && winningSide === "a" ? "text-emerald-600 dark:text-emerald-400" :
                userEntrySide === "a" ? "text-primary" : "text-muted-foreground"
              }`}>{pctA}%</span>
            </div>
          )}

          {/* Option B */}
          {canBet ? (
            <button
              onClick={(e) => handleBetClick(e, "b")}
              disabled={!!joining}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-rose-500/8 to-rose-500/4 border border-rose-500/25 hover:border-rose-500/50 hover:from-rose-500/12 hover:to-rose-500/8 transition-all disabled:opacity-50"
            >
              <span className="text-sm font-medium text-rose-700 dark:text-rose-400 truncate pr-2">
                {joining === "b" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : sideB}
              </span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">{pctB}%</span>
            </button>
          ) : (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
              isSettled && winningSide === "b"
                ? "bg-emerald-500/15 border-2 border-emerald-500/60"
                : userEntrySide === "b"
                ? "bg-primary/10 border-2 border-primary/50"
                : "bg-muted/40 border border-border/50"
            }`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-sm font-medium truncate ${
                  isSettled && winningSide === "b" ? "text-emerald-700 dark:text-emerald-400" :
                  userEntrySide === "b" ? "text-primary" : "text-muted-foreground"
                }`}>{sideB}</span>
                {isSettled && winningSide === "b" && <Trophy className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                {userEntrySide === "b" && isOpen && <span className="text-[9px] bg-primary text-white px-1 rounded">YOU</span>}
              </div>
              <span className={`text-base font-bold tabular-nums ${
                isSettled && winningSide === "b" ? "text-emerald-600 dark:text-emerald-400" :
                userEntrySide === "b" ? "text-primary" : "text-muted-foreground"
              }`}>{pctB}%</span>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <footer className="px-3.5 py-2 bg-muted/20 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1 font-medium">
              <TrendingUp className="h-3 w-3" />
              ₦{vol}
            </span>
            <span className="opacity-60">
              {formatCurrency(amount, currency as Currency)}/bet
            </span>
          </div>
          {entriesCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {entriesCount}
            </span>
          )}
        </footer>
        </article>
      </Link>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Confirm Your Bet"
        description={
          selectedSide
            ? `You are about to bet ${formatCurrency(amount, currency as Currency)} on "${selectedSide === "a" ? sideA : sideB}" for "${title}". This amount will be deducted from your wallet. Are you sure?`
            : "Are you sure you want to place this bet?"
        }
        confirmText="Place Bet"
        cancelText="Cancel"
        onConfirm={confirmBet}
      />
    </>
  );
};

// Memoize with shallow comparison
export const WagerCard = memo(WagerCardComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.status === next.status &&
    prev.entriesCount === next.entriesCount &&
    prev.sideATotal === next.sideATotal &&
    prev.sideBTotal === next.sideBTotal &&
    prev.winningSide === next.winningSide &&
    prev.userEntrySide === next.userEntrySide
  );
});
