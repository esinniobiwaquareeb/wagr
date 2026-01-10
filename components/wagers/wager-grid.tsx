"use client";

import { WagerCard } from "@/components/wager-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Home as HomeIcon, Plus } from "lucide-react";

interface WagerWithEntries {
  id: string;
  title: string;
  side_a: string;
  side_b: string;
  amount: number;
  min_amount?: number | null;
  max_amount?: number | null;
  status: string;
  entries_count: number;
  deadline: string | null;
  currency?: string;
  category?: any;
  side_a_total?: number;
  side_b_total?: number;
  is_system_generated?: boolean;
  winning_side?: string | null;
  short_id?: string | null;
  marketLiquidity?: any;
}

interface WagerGridProps {
  loading: boolean;
  wagers: WagerWithEntries[];
  userEntries: Map<string, { amount: number; side: string }>;
  searchQuery: string;
  selectedCategory: string | null;
  onClearFilters: () => void;
  onCreateClick: () => void;
  getCategorySlug: (category: any) => string | null;
}

export function WagerGrid({
  loading,
  wagers,
  userEntries,
  searchQuery,
  selectedCategory,
  onClearFilters,
  onCreateClick,
  getCategorySlug,
}: WagerGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 lg:p-5 shadow-sm">
            <Skeleton className="h-6 w-3/4 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3 mb-4" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (wagers.length === 0) {
    return (
      <div className="text-center py-16 lg:py-20 bg-card border border-border rounded-xl lg:rounded-2xl shadow-sm">
        <div className="max-w-md mx-auto px-4">
          <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <HomeIcon className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl lg:text-2xl font-bold mb-3">No markets found</h3>
          <p className="text-sm lg:text-base text-muted-foreground mb-6">
            {searchQuery
              ? "Try a different search term or clear your filters"
              : selectedCategory
              ? `No markets found in "${selectedCategory}" category`
              : "Be the first to create a market!"}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {(searchQuery || selectedCategory) && (
              <button
                onClick={onClearFilters}
                className="inline-flex items-center justify-center gap-2 bg-muted text-foreground px-6 py-3 rounded-lg font-medium hover:bg-muted/80 transition-all active:scale-95 touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={onCreateClick}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-all active:scale-95 touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] shadow-sm hover:shadow-md"
            >
              <Plus className="h-5 w-5" />
              <span>Create Market</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
      {wagers.map((wager) => (
        <WagerCard
          key={wager.id}
          id={wager.id}
          title={wager.title}
          sideA={wager.side_a}
          sideB={wager.side_b}
          amount={wager.min_amount ?? wager.amount}
          status={wager.status}
          entriesCount={wager.entries_count}
          deadline={wager.deadline || ""}
          currency={wager.currency}
          category={getCategorySlug(wager.category) || undefined}
          sideATotal={wager.side_a_total || 0}
          sideBTotal={wager.side_b_total || 0}
          isSystemGenerated={wager.is_system_generated || false}
          winningSide={wager.winning_side}
          shortId={wager.short_id}
          userEntrySide={userEntries.get(wager.id)?.side}
          minAmount={wager.min_amount ?? null}
          maxAmount={wager.max_amount ?? null}
          marketLiquidity={wager.marketLiquidity}
        />
      ))}
    </div>
  );
}
