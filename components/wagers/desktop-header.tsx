"use client";

import { Search, X, Plus, SlidersHorizontal } from "lucide-react";

interface DesktopHeaderProps {
  wagerCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string | null;
  allCategories: string[];
  onCategoryChange: (category: string | null) => void;
  onCreateClick: () => void;
}

export function DesktopHeader({
  wagerCount,
  searchQuery,
  onSearchChange,
  selectedCategory,
  allCategories,
  onCategoryChange,
  onCreateClick,
}: DesktopHeaderProps) {
  return (
    <div className="hidden lg:block mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold mb-0.5">Active Markets</h1>
          <p className="text-xs text-muted-foreground">
            {wagerCount} {wagerCount === 1 ? 'market' : 'markets'} available
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Desktop Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-56 pl-9 pr-8 py-2 bg-muted/50 dark:bg-muted/60 border border-border dark:border-border/70 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-background dark:focus:bg-muted/80 focus:border-primary/50 dark:focus:border-primary/60 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {/* Desktop Category Filter */}
          {allCategories.length > 0 && (
            <div className="relative">
              <select
                value={selectedCategory || ''}
                onChange={(e) => onCategoryChange(e.target.value || null)}
                className="appearance-none pl-3 pr-7 py-2 bg-muted/50 dark:bg-muted/60 border border-border dark:border-border/70 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-background dark:focus:bg-muted/80 focus:border-primary/50 dark:focus:border-primary/60 transition-all cursor-pointer min-w-[120px]"
              >
                <option value="">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat} className="capitalize">
                    {cat}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          )}
          <button
            onClick={onCreateClick}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 hover:shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create</span>
          </button>
        </div>
      </div>
    </div>
  );
}
