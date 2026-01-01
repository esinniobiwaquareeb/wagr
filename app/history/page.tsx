"use client";

import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { History, Trophy, XCircle, Clock, Filter, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { DeadlineDisplay } from "@/components/deadline-display";
import { logger } from "@/lib/logger";

interface WagerEntry {
  id: string;
  wager_id: string;
  side: string;
  amount: number;
  created_at: string;
  wager: {
    id: string;
    title: string;
    description: string;
    side_a: string;
    side_b: string;
    amount: number;
    status: string;
    deadline: string;
    winning_side: string | null;
    currency?: string;
    category?: string;
    created_at: string;
  };
}

type FilterType = 'all' | 'open' | 'resolved' | 'won' | 'lost' | 'refunded';

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryPageSkeleton />}>
      <HistoryPageContent />
    </Suspense>
  );
}

function HistoryPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-12 bg-muted rounded" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<WagerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currency = DEFAULT_CURRENCY as Currency;

  const fetchingRef = useRef(false);

  const fetchHistory = useCallback(async (force = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;

    if (refreshing && !force) {
      fetchingRef.current = false;
      return;
    }
    if (force) setRefreshing(true);

    try {
      // Call the dedicated endpoint to get user's wagers (created or participated)
      const response = await fetch(`/api/wagers/my-wagers?limit=500`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wager history');
      }

      const data = await response.json();
      
      if (data.success && data.data?.wagers) {
        // Transform the response to match the expected format
        // Include wagers where user has an entry OR is the creator
        const transformedEntries: WagerEntry[] = data.data.wagers
          .map((wager: any) => {
            // If user has an entry, use that
            if (wager.userEntry) {
              return {
                id: wager.userEntry.id,
                wager_id: wager.id,
                side: wager.userEntry.side,
                amount: wager.userEntry.amount,
                created_at: wager.userEntry.created_at,
                wager: {
                  id: wager.id,
                  title: wager.title,
                  description: wager.description || '',
                  side_a: wager.side_a,
                  side_b: wager.side_b,
                  amount: parseFloat(wager.amount || 0),
                  status: wager.status,
                  deadline: wager.deadline,
                  winning_side: wager.winning_side,
                  currency: wager.currency || 'NGN',
                  category: wager.category?.slug || wager.category?.label || wager.category_id || null,
                  created_at: wager.created_at,
                },
              } as WagerEntry;
            }
            // If user is creator but has no entry, create a placeholder entry
            if (wager.isCreator) {
              return {
                id: `creator-${wager.id}`, // Placeholder ID
                wager_id: wager.id,
                side: 'a', // Default side for creator
                amount: 0, // No entry amount
                created_at: wager.created_at, // Use wager creation date
                wager: {
                  id: wager.id,
                  title: wager.title,
                  description: wager.description || '',
                  side_a: wager.side_a,
                  side_b: wager.side_b,
                  amount: parseFloat(wager.amount || 0),
                  status: wager.status,
                  deadline: wager.deadline,
                  winning_side: wager.winning_side,
                  currency: wager.currency || 'NGN',
                  category: wager.category?.slug || wager.category?.label || wager.category_id || null,
                  created_at: wager.created_at,
                },
              } as WagerEntry;
            }
            return null;
          })
          .filter((e: WagerEntry | null): e is WagerEntry => e !== null);

        // Sort by created_at descending
        transformedEntries.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setEntries(transformedEntries);
      } else {
        setEntries([]);
      }
    } catch (error) {
      logger.error('Error fetching history', error);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, [user, refreshing]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        setShowAuthModal(true);
      } else {
        fetchHistory();
      }
    }
  }, [user, authLoading]); // Removed fetchHistory from dependencies to prevent re-renders

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: () => fetchHistory(true),
    threshold: 80,
    disabled: loading,
  });

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;

    return entries.filter((entry) => {
      const wager = entry.wager;
      
      if (filter === 'open') {
        return wager.status === 'OPEN';
      }
      
      if (filter === 'resolved') {
        return wager.status === 'RESOLVED' || wager.status === 'SETTLED';
      }
      
      if (filter === 'won') {
        return (wager.status === 'RESOLVED' || wager.status === 'SETTLED') && wager.winning_side === entry.side;
      }
      
      if (filter === 'lost') {
        return (wager.status === 'RESOLVED' || wager.status === 'SETTLED') && wager.winning_side !== null && wager.winning_side !== entry.side;
      }
      
      if (filter === 'refunded') {
        return wager.status === 'REFUNDED';
      }
      
      return true;
    });
  }, [entries, filter]);

  const stats = useMemo(() => {
    const total = entries.length;
    const open = entries.filter(e => e.wager.status === 'OPEN').length;
    const resolved = entries.filter(e => e.wager.status === 'RESOLVED' || e.wager.status === 'SETTLED').length;
    const won = entries.filter(e => (e.wager.status === 'RESOLVED' || e.wager.status === 'SETTLED') && e.wager.winning_side === e.side).length;
    const lost = entries.filter(e => (e.wager.status === 'RESOLVED' || e.wager.status === 'SETTLED') && e.wager.winning_side !== null && e.wager.winning_side !== e.side).length;
    const refunded = entries.filter(e => e.wager.status === 'REFUNDED').length;

    return { total, open, resolved, won, lost, refunded };
  }, [entries]);

  if (authLoading || loading) {
    return <HistoryPageSkeleton />;
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Please log in</h2>
            <p className="text-muted-foreground">You need to be logged in to view your wager history.</p>
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            router.push("/wagers");
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg transition-transform ${
            pullDistance > 80 ? 'scale-105' : ''
          }`}>
            <Loader2 className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Refreshing...' : pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header with integrated back button */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-start gap-3 mb-2 md:mb-3">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold mb-1 md:mb-2">Wager History</h1>
              <p className="text-muted-foreground text-xs md:text-sm">
                View all wagers you've participated in
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-3 md:p-4">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Total</div>
            <div className="text-lg md:text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 md:p-4">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Open</div>
            <div className="text-lg md:text-2xl font-bold text-green-600">{stats.open}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 md:p-4">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Resolved</div>
            <div className="text-lg md:text-2xl font-bold text-blue-600">{stats.resolved}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 md:p-4">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Won</div>
            <div className="text-lg md:text-2xl font-bold text-green-600">{stats.won}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 md:p-4">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Lost</div>
            <div className="text-lg md:text-2xl font-bold text-red-600">{stats.lost}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 md:p-4">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Refunded</div>
            <div className="text-lg md:text-2xl font-bold text-orange-600">{stats.refunded}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition ${
              filter === 'open'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Open ({stats.open})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition ${
              filter === 'resolved'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Resolved ({stats.resolved})
          </button>
          <button
            onClick={() => setFilter('won')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition ${
              filter === 'won'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Won ({stats.won})
          </button>
          <button
            onClick={() => setFilter('lost')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition ${
              filter === 'lost'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Lost ({stats.lost})
          </button>
          <button
            onClick={() => setFilter('refunded')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition ${
              filter === 'refunded'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Refunded ({stats.refunded})
          </button>
        </div>

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 md:py-16">
            <History className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg md:text-xl font-semibold mb-2">No wagers found</h3>
            <p className="text-muted-foreground text-sm md:text-base mb-6">
              {filter === 'all' 
                ? "You haven't participated in any wagers yet."
                : `No ${filter} wagers found.`}
            </p>
            <Link
              href="/wagers"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Browse Wagers
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEntries.map((entry) => {
              const wager = entry.wager;
              const isWon = (wager.status === 'RESOLVED' || wager.status === 'SETTLED') && wager.winning_side === entry.side;
              const isLost = (wager.status === 'RESOLVED' || wager.status === 'SETTLED') && wager.winning_side !== null && wager.winning_side !== entry.side;
              const sideLabel = entry.side === 'a' ? wager.side_a : wager.side_b;
              const entryCurrency = (wager.currency || currency) as Currency;

              return (
                <Link
                  key={entry.id}
                  href={`/wager/${wager.id}`}
                  className="block group"
                >
                  <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer active:scale-[0.99] touch-manipulation h-full flex flex-col relative overflow-hidden">
                    {/* Status indicator bar */}
                    <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                      wager.status === 'REFUNDED'
                        ? 'bg-orange-500'
                        : wager.status === 'RESOLVED' || wager.status === 'SETTLED'
                        ? isWon ? 'bg-green-500' : isLost ? 'bg-red-500' : 'bg-blue-500'
                        : 'bg-green-500'
                    }`} />

                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground text-xs md:text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors flex-1">
                        {wager.title}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {wager.status === 'OPEN' && (
                          <span className="px-1.5 py-0.5 text-[8px] rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                            OPEN
                          </span>
                        )}
                        {wager.status === 'REFUNDED' && (
                          <span className="px-1.5 py-0.5 text-[8px] rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
                            REFUNDED
                          </span>
                        )}
                        {(wager.status === 'RESOLVED' || wager.status === 'SETTLED') && (
                          isWon ? <Trophy className="h-4 w-4 text-green-600" />
                          : isLost ? <XCircle className="h-4 w-4 text-red-600" />
                          : <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </div>

                    {/* Compact sides */}
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      <div className={`px-2 py-1.5 rounded border text-center ${
                        entry.side === 'a'
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-transparent bg-muted/40'
                      }`}>
                        <div className={`text-[10px] font-medium truncate ${
                          entry.side === 'a' ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {wager.side_a}
                        </div>
                        {entry.side === 'a' && (
                          <div className="text-[9px] font-bold text-primary">
                            {formatCurrency(entry.amount, entryCurrency)}
                          </div>
                        )}
                      </div>
                      <div className={`px-2 py-1.5 rounded border text-center ${
                        entry.side === 'b'
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-transparent bg-muted/40'
                      }`}>
                        <div className={`text-[10px] font-medium truncate ${
                          entry.side === 'b' ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {wager.side_b}
                        </div>
                        {entry.side === 'b' && (
                          <div className="text-[9px] font-bold text-primary">
                            {formatCurrency(entry.amount, entryCurrency)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Result or Refund badge - inline compact */}
                    {(wager.status === 'RESOLVED' || wager.status === 'SETTLED') && (
                      <div className={`text-[9px] px-2 py-1 rounded mb-2 flex items-center justify-between ${
                        isWon ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : isLost ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      }`}>
                        <span className="font-medium">{isWon ? '🎉 Won' : isLost ? '✗ Lost' : '✓ Resolved'}</span>
                        <span className="font-semibold truncate ml-2">Winner: {wager.winning_side === 'a' ? wager.side_a : wager.side_b}</span>
                      </div>
                    )}

                    {wager.status === 'REFUNDED' && (
                      <div className="text-[9px] px-2 py-1 rounded mb-2 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-medium">
                        ↩ Entry refunded
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto pt-2 border-t border-border/50 flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>
                        {format(new Date(entry.created_at), 'MMM d')}
                      </span>
                      {wager.deadline && wager.status === 'OPEN' && (
                        <DeadlineDisplay deadline={wager.deadline} size="sm" showLabel={false} />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

