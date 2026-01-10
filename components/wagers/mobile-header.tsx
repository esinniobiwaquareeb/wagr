"use client";

import { Plus, SlidersHorizontal } from "lucide-react";

interface MobileHeaderProps {
  wagerCount: number;
  hasActiveFilters: boolean;
  onCreateClick: () => void;
  onFilterToggle: () => void;
  filterCount: number;
}

export function MobileHeader({
  wagerCount,
  hasActiveFilters,
  onCreateClick,
  onFilterToggle,
  filterCount,
}: MobileHeaderProps) {
  return (
    <div className="lg:hidden mb-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">Markets</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {wagerCount} {wagerCount === 1 ? 'market' : 'markets'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <button
            onClick={onCreateClick}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-all active:scale-95 touch-manipulation"
            aria-label="Create market"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onFilterToggle}
            className={`relative flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all ${
              hasActiveFilters
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {filterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border border-background flex items-center justify-center">
                <span className="text-[7px] font-bold text-white">{filterCount}</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
