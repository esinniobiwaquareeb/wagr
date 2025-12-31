"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, History, Plus, Eye, EyeOff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { logger } from "@/lib/logger";
import { CreateWagerModal } from "@/components/create-wager-modal";

interface Wager {
  id: string;
  title: string;
  amount: number;
  currency?: string;
  status: string;
  is_public: boolean;
  entries_count: number;
  short_id?: string | null;
}

interface MyWagersCardProps {
  /**
   * Title for the card
   */
  title?: string;
  /**
   * Maximum number of wagers to fetch
   */
  limit?: number;
  /**
   * Show create wager button in header
   */
  showCreateButton?: boolean;
  /**
   * Show history link in header
   */
  showHistoryLink?: boolean;
  /**
   * Show empty state with create button
   */
  showEmptyState?: boolean;
  /**
   * Maximum height for the wagers list (with scroll)
   */
  maxHeight?: string;
  /**
   * Callback when a wager is clicked
   */
  onWagerClick?: (wager: Wager) => void;
  /**
   * Callback when create wager is clicked
   */
  onCreateWager?: () => void;
  /**
   * Callback when wager is successfully created
   */
  onWagerCreated?: () => void;
  /**
   * Custom className for the card
   */
  className?: string;
  /**
   * Variant: 'compact' for sidebar, 'full' for main content
   */
  variant?: "compact" | "full";
}

export function MyWagersCard({
  title = "My Wagers",
  limit = 50,
  showCreateButton = true,
  showHistoryLink = true,
  showEmptyState = true,
  maxHeight = "max-h-96",
  onWagerClick,
  onCreateWager,
  onWagerCreated,
  className = "",
  variant = "full",
}: MyWagersCardProps) {
  const { user } = useAuth();
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchMyWagers = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/wagers/my-wagers?limit=${limit}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        setWagers([]);
        return;
      }

      const data = await response.json();
      if (data.success && data.data?.wagers) {
        // Filter to only show wagers where the user is the creator
        const creatorWagers = data.data.wagers.filter(
          (wager: any) => wager.isCreator === true
        );

        // Transform wagers to include entry counts
        const wagersWithCounts = creatorWagers.map((wager: any) => ({
          ...wager,
          entries_count: wager.entryCounts?.total || 0,
          amount: parseFloat(wager.amount || 0),
        }));

        setWagers(wagersWithCounts);
      } else {
        setWagers([]);
      }
    } catch (error) {
      logger.error("Error fetching my wagers", error);
      setWagers([]);
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  useEffect(() => {
    if (user) {
      fetchMyWagers();
    }
  }, [user, fetchMyWagers]);

  const handleCreateClick = () => {
    if (onCreateWager) {
      onCreateWager();
    } else {
      setShowCreateModal(true);
    }
  };

  const handleWagerClick = (wager: Wager) => {
    if (onWagerClick) {
      onWagerClick(wager);
    }
  };

  const handleWagerCreated = () => {
    fetchMyWagers();
    if (onWagerCreated) {
      onWagerCreated();
    }
    setShowCreateModal(false);
  };

  if (!user) {
    return null;
  }

  const cardPadding = variant === "compact" ? "p-4 md:p-5" : "p-4 md:p-6";
  const titleSize = variant === "compact" ? "text-xs" : "text-sm";

  return (
    <>
      <div className={`bg-card border border-border rounded-xl ${cardPadding} ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${titleSize} font-semibold flex items-center gap-2`}>
            <Trophy className="h-4 w-4 text-primary flex-shrink-0" />
            <span>{title}</span>
            {wagers.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({wagers.length})
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {showHistoryLink && (
              <Link
                href="/history"
                className="p-2 hover:bg-muted rounded-lg transition active:scale-95 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="View history"
              >
                <History className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            {showCreateButton && (
              <button
                onClick={handleCreateClick}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition active:scale-95 touch-manipulation text-sm font-medium min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 md:py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading wagers...</p>
          </div>
        ) : wagers.length === 0 ? (
          showEmptyState ? (
            <div className="text-center py-8 md:py-12 border-2 border-dashed border-muted rounded-xl">
              <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 mb-3 md:mb-4">
                <Trophy className="h-6 w-6 md:h-8 md:w-8 text-primary/60" />
              </div>
              <p className="text-sm font-medium mb-1">No wagers yet</p>
              <p className="text-xs text-muted-foreground mb-4 px-4">
                Start creating and sharing wagers with others
              </p>
              {showCreateButton && (
                <button
                  onClick={handleCreateClick}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition active:scale-95 touch-manipulation text-sm font-medium min-h-[44px]"
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Wager
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No wagers yet</p>
            </div>
          )
        ) : (
          <div className={`space-y-2 ${maxHeight} overflow-y-auto`}>
            {wagers.map((wager) => {
              const wagerUrl = `/wager/${wager.short_id || wager.id}`;
              return (
                <Link
                  key={wager.id}
                  href={wagerUrl}
                  onClick={(e) => {
                    if (onWagerClick) {
                      e.preventDefault();
                      handleWagerClick(wager);
                    }
                  }}
                  className="block p-3 md:p-3.5 bg-muted/30 hover:bg-muted rounded-lg transition-all active:scale-[0.98] touch-manipulation border border-transparent hover:border-border min-h-[44px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                        <h4 className="text-sm font-semibold line-clamp-2">
                          {wager.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {wager.is_public ? (
                            <div title="Public">
                              <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                          ) : (
                            <div title="Private">
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                          )}
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                              wager.status === "OPEN"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : wager.status === "RESOLVED" ||
                                  wager.status === "SETTLED"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {wager.status === "SETTLED"
                              ? "Settled"
                              : wager.status === "RESOLVED"
                              ? "Resolved"
                              : wager.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium">
                          {wager.entries_count}{" "}
                          {wager.entries_count === 1 ? "entry" : "entries"}
                        </span>
                        <span>•</span>
                        <span>
                          {formatCurrency(
                            wager.amount,
                            (wager.currency || DEFAULT_CURRENCY) as Currency
                          )}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showCreateButton && (
        <CreateWagerModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={handleWagerCreated}
        />
      )}
    </>
  );
}

