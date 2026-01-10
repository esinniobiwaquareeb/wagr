"use client";

import Link from "next/link";
import { memo, useCallback, useMemo, useState, useEffect } from "react";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Sparkles, Users, TrendingUp, Trophy, Loader2, Clock } from "lucide-react";
import { wagersApi } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { useUserCurrency } from "@/hooks/use-user-currency";
import { isDeadlineElapsed, getTimeRemaining } from "@/lib/deadline-utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";

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
  minAmount?: number | null;
  maxAmount?: number | null;
  marketLiquidity?: {
    sideATotal: number;
    sideBTotal: number;
    totalPool: number;
    sideAOdds: number;
    sideBOdds: number;
    sideAPercent: number;
    sideBPercent: number;
    sideAParticipants: number;
    sideBParticipants: number;
  };
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
  currency: wagerCurrency = DEFAULT_CURRENCY,
  isSystemGenerated = false,
  category,
  sideATotal = 0,
  sideBTotal = 0,
  winningSide,
  shortId,
  userEntrySide,
  minAmount,
  maxAmount,
  marketLiquidity,
}: WagerCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getSetting } = useSettings();
  const { currency: userCurrency } = useUserCurrency();
  const defaultPlatformFee = getSetting('fees.wager_platform_fee_percentage', PLATFORM_FEE_PERCENTAGE) as number;
  const [joining, setJoining] = useState<"a" | "b" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);
  const [entryAmount, setEntryAmount] = useState<string>("");
  const [variableAmountsEnabled, setVariableAmountsEnabled] = useState<boolean>(false);

  // Check if variable amounts feature is enabled
  useEffect(() => {
    try {
      const enabled = getSetting('wagers.variable_amounts_enabled', false) as boolean;
      setVariableAmountsEnabled(enabled);
    } catch (error) {
      setVariableAmountsEnabled(false);
    }
  }, [getSetting]);

  // Memoized calculations - use marketLiquidity if available, otherwise calculate from sideATotal/sideBTotal
  const { pool, pctA, pctB, vol, oddsA, oddsB, balanceStatus } = useMemo(() => {
    if (marketLiquidity) {
      const imbalanceRatio = Math.max(marketLiquidity.sideAPercent, marketLiquidity.sideBPercent) / 100;
      return {
        pool: marketLiquidity.totalPool,
        pctA: marketLiquidity.sideAPercent,
        pctB: marketLiquidity.sideBPercent,
        vol: formatVol(marketLiquidity.totalPool),
        oddsA: marketLiquidity.sideAOdds,
        oddsB: marketLiquidity.sideBOdds,
        balanceStatus: imbalanceRatio > 0.9 ? 'severe' : imbalanceRatio > 0.7 ? 'moderate' : 'balanced',
      };
    }
    const total = sideATotal + sideBTotal;
    const imbalanceRatio = total > 0 ? Math.max(sideATotal, sideBTotal) / total : 0.5;
    return {
      pool: total,
      pctA: total > 0 ? Math.round((sideATotal / total) * 100) : 50,
      pctB: total > 0 ? Math.round((sideBTotal / total) * 100) : 50,
      vol: formatVol(total),
      oddsA: total > 0 && sideATotal > 0 ? parseFloat((total / sideATotal).toFixed(2)) : 1.0,
      oddsB: total > 0 && sideBTotal > 0 ? parseFloat((total / sideBTotal).toFixed(2)) : 1.0,
      balanceStatus: imbalanceRatio > 0.9 ? 'severe' : imbalanceRatio > 0.7 ? 'moderate' : 'balanced',
    };
  }, [sideATotal, sideBTotal, marketLiquidity]);

  const timeInfo = useMemo(() => deadline ? getTimeDisplay(deadline) : null, [deadline]);
  const isOpen = status === "OPEN";
  const isSettled = status === "SETTLED" || status === "RESOLVED";
  const userPicked = userEntrySide === "a" || userEntrySide === "b";
  const canJoin = isOpen && user && !userPicked && !isDeadlineElapsed(deadline);

  // Handle click to show confirmation dialog
  const handleJoinClick = useCallback((e: React.MouseEvent, side: "a" | "b") => {
    e.preventDefault();
    e.stopPropagation();

    if (!canJoin || joining) return;

    const remaining = getTimeRemaining(deadline);
    if (remaining > 0 && remaining <= 20000) {
      toast({ title: "Too late", description: "Cannot join wager within 20s of deadline.", variant: "destructive" });
      return;
    }

    // Show confirmation dialog
    setSelectedSide(side);
    setShowConfirmDialog(true);
  }, [canJoin, joining, deadline, toast]);

  // Confirm and execute the wager
  const confirmBet = useCallback(async () => {
    if (!selectedSide || joining) return;

    setJoining(selectedSide);
    setShowConfirmDialog(false);
    
    try {
      // Prepare join payload with optional amount
      const joinAmount = variableAmountsEnabled && entryAmount 
        ? parseFloat(entryAmount) 
        : undefined;
      
      await wagersApi.join(id, selectedSide, joinAmount);
      toast({ title: "Joined!", description: `You joined ${selectedSide === "a" ? sideA : sideB}` });
      
      // Dispatch events to update UI
      // Dispatch balance-updated event to refresh balance in top nav
      // Add a small delay to ensure database transaction is committed
      if (typeof window !== 'undefined') {
        // Dispatch immediately
        window.dispatchEvent(new CustomEvent('balance-updated'));
        // Also dispatch after a short delay to ensure transaction is committed
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('balance-updated'));
        }, 300);
      }
      window.dispatchEvent(new Event('wager-updated'));
      setEntryAmount(""); // Reset amount
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message || "Could not join.", variant: "destructive" });
    } finally {
      setJoining(null);
      setSelectedSide(null);
    }
  }, [selectedSide, joining, id, sideA, sideB, toast, variableAmountsEnabled, entryAmount]);

  const linkId = shortId || id;

  return (
    <>
      <Link href={`/wager/${linkId}`} className="block group" prefetch={false}>
        <article className="bg-card border border-border/60 dark:border-border/80 rounded-2xl overflow-hidden hover:border-primary/40 dark:hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-200 h-full flex flex-col">
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
          {canJoin ? (
            <button
              onClick={(e) => handleJoinClick(e, "a")}
              disabled={!!joining}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500/8 to-emerald-500/4 dark:from-emerald-500/12 dark:to-emerald-500/8 border border-emerald-500/25 dark:border-emerald-500/35 hover:border-emerald-500/50 dark:hover:border-emerald-500/60 hover:from-emerald-500/12 hover:to-emerald-500/8 dark:hover:from-emerald-500/16 dark:hover:to-emerald-500/12 transition-all disabled:opacity-50"
            >
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 truncate pr-2">
                {joining === "a" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : sideA}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{pctA}%</span>
                {pool > 0 && (
                  <span className="text-[10px] text-muted-foreground">({oddsA}x)</span>
                )}
              </div>
            </button>
          ) : (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
              isSettled && winningSide === "a"
                ? "bg-emerald-500/15 dark:bg-emerald-500/20 border-2 border-emerald-500/60 dark:border-emerald-500/70"
                : userEntrySide === "a"
                ? "bg-primary/10 dark:bg-primary/15 border-2 border-primary/50 dark:border-primary/60"
                : "bg-muted/40 dark:bg-muted/60 border border-border/50 dark:border-border/70"
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
          {canJoin ? (
            <button
              onClick={(e) => handleJoinClick(e, "b")}
              disabled={!!joining}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-rose-500/8 to-rose-500/4 dark:from-rose-500/12 dark:to-rose-500/8 border border-rose-500/25 dark:border-rose-500/35 hover:border-rose-500/50 dark:hover:border-rose-500/60 hover:from-rose-500/12 hover:to-rose-500/8 dark:hover:from-rose-500/16 dark:hover:to-rose-500/12 transition-all disabled:opacity-50"
            >
              <span className="text-sm font-medium text-rose-700 dark:text-rose-400 truncate pr-2">
                {joining === "b" ? <Loader2 className="h-4 w-4 animate-spin inline" /> : sideB}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">{pctB}%</span>
                {pool > 0 && (
                  <span className="text-[10px] text-muted-foreground">({oddsB}x)</span>
                )}
              </div>
            </button>
          ) : (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
              isSettled && winningSide === "b"
                ? "bg-emerald-500/15 dark:bg-emerald-500/20 border-2 border-emerald-500/60 dark:border-emerald-500/70"
                : userEntrySide === "b"
                ? "bg-primary/10 dark:bg-primary/15 border-2 border-primary/50 dark:border-primary/60"
                : "bg-muted/40 dark:bg-muted/60 border border-border/50 dark:border-border/70"
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
        <footer className="px-3.5 py-2 bg-muted/20 dark:bg-muted/30 border-t border-border/30 dark:border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1 font-medium">
              <TrendingUp className="h-3 w-3" />
              ₦{vol}
            </span>
            <span className="opacity-60">
              {formatCurrency(amount, (wagerCurrency || DEFAULT_CURRENCY) as Currency, userCurrency.symbol)}/wager
            </span>
            {/* Balance Indicator */}
            {pool > 0 && (
              <span 
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  balanceStatus === 'severe' 
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                    : balanceStatus === 'moderate'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                }`}
                title={
                  balanceStatus === 'severe' 
                    ? 'Severely imbalanced market'
                    : balanceStatus === 'moderate'
                    ? 'Moderately imbalanced market'
                    : 'Balanced market'
                }
              >
                {balanceStatus === 'severe' ? '⚠️' : balanceStatus === 'moderate' ? '⚖️' : '✓'}
                {balanceStatus === 'balanced' ? 'Balanced' : Math.max(pctA, pctB) + '%'}
              </span>
            )}
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
        onOpenChange={(open) => {
          setShowConfirmDialog(open);
          if (!open) {
            setEntryAmount(""); // Reset amount when dialog closes
          }
        }}
        title="Join Wager"
        description={
          selectedSide ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Join "{title}" on <strong>{selectedSide === "a" ? sideA : sideB}</strong>
              </p>
              {variableAmountsEnabled ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Enter Amount</label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                      placeholder={`Min: ${formatCurrency(minAmount ?? amount, (wagerCurrency || DEFAULT_CURRENCY) as Currency, userCurrency.symbol)}${maxAmount ? `, Max: ${formatCurrency(maxAmount, (wagerCurrency || DEFAULT_CURRENCY) as Currency, userCurrency.symbol)}` : ''}`}
                      min={minAmount ?? amount}
                      max={maxAmount ?? undefined}
                      step="0.01"
                      className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum: {formatCurrency(minAmount ?? amount, (wagerCurrency || DEFAULT_CURRENCY) as Currency, userCurrency.symbol)}
                      {maxAmount && ` • Maximum: ${formatCurrency(maxAmount, (wagerCurrency || DEFAULT_CURRENCY) as Currency, userCurrency.symbol)}`}
                    </p>
                    {/* Real-time potential returns display */}
                    {entryAmount && parseFloat(entryAmount) > 0 && (
                      (() => {
                        const amount = parseFloat(entryAmount);
                        const joinReturns = calculatePotentialReturns({
                          entryAmount: amount,
                          sideATotal: marketLiquidity?.sideATotal ?? sideATotal,
                          sideBTotal: marketLiquidity?.sideBTotal ?? sideBTotal,
                          feePercentage: defaultPlatformFee,
                        });
                        const selectedSideReturns = selectedSide === "a" ? joinReturns.sideAPotential : joinReturns.sideBPotential;
                        const selectedSideMultiplier = selectedSide === "a" ? joinReturns.sideAReturnMultiplier : joinReturns.sideBReturnMultiplier;
                        const selectedSidePercentage = selectedSide === "a" ? joinReturns.sideAReturnPercentage : joinReturns.sideBReturnPercentage;
                        return (
                          <div className="mt-2 p-2 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30">
                            <p className="text-xs font-medium text-primary mb-1">Potential Returns</p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">If you win:</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(selectedSideReturns, (wagerCurrency || DEFAULT_CURRENCY) as Currency, userCurrency.symbol)}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Return:</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatReturnMultiplier(selectedSideMultiplier)} ({formatReturnPercentage(selectedSidePercentage)})
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    This will deduct {formatCurrency(minAmount ?? amount, (wagerCurrency || DEFAULT_CURRENCY) as Currency, userCurrency.symbol)} from your balance.
                  </p>
                  {/* Show potential returns for fixed amount */}
                  {(() => {
                    const fixedAmount = minAmount ?? amount;
                    const fixedReturns = calculatePotentialReturns({
                      entryAmount: fixedAmount,
                      sideATotal: marketLiquidity?.sideATotal ?? sideATotal,
                      sideBTotal: marketLiquidity?.sideBTotal ?? sideBTotal,
                      feePercentage: defaultPlatformFee,
                    });
                    const selectedSideReturns = selectedSide === "a" ? fixedReturns.sideAPotential : fixedReturns.sideBPotential;
                    const selectedSideMultiplier = selectedSide === "a" ? fixedReturns.sideAReturnMultiplier : fixedReturns.sideBReturnMultiplier;
                    const selectedSidePercentage = selectedSide === "a" ? fixedReturns.sideAReturnPercentage : fixedReturns.sideBReturnPercentage;
                    return (
                      <div className="mt-2 p-2 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30">
                        <p className="text-xs font-medium text-primary mb-1">Potential Returns</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">If you win:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(selectedSideReturns, (wagerCurrency || DEFAULT_CURRENCY) as Currency, userCurrency.symbol)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Return:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatReturnMultiplier(selectedSideMultiplier)} ({formatReturnPercentage(selectedSidePercentage)})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            "Are you sure you want to join this wager?"
          )
        }
        confirmText="Join"
        cancelText="Cancel"
        onConfirm={confirmBet}
        loading={!!joining}
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
