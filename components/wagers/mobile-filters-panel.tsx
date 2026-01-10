"use client";

import { Search, X } from "lucide-react";

interface MobileFiltersPanelProps {
  isOpen: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string | null;
  allCategories: string[];
  onCategoryChange: (category: string | null) => void;
  onClearFilters: () => void;
}

export function MobileFiltersPanel({
  isOpen,
  searchQuery,
  onSearchChange,
  selectedCategory,
  allCategories,
  onCategoryChange,
  onClearFilters,
}: MobileFiltersPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="space-y-2.5 p-2.5 bg-card border border-border dark:border-border/80 rounded-lg shadow-sm">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-background dark:bg-muted/40 border border-border dark:border-border/70 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/60 focus:border-primary/50 dark:focus:border-primary/60"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      {allCategories.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onCategoryChange(null)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                !selectedCategory
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all capitalize ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters & Clear */}
      {(selectedCategory || searchQuery) && (
          <div className="flex items-center justify-between pt-1.5 border-t border-border dark:border-border/70">
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedCategory && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                <span className="capitalize">{selectedCategory}</span>
                <button
                  onClick={() => onCategoryChange(null)}
                  className="hover:bg-primary/20 rounded-full p-0.5 -mr-1"
                  aria-label="Remove category filter"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
                <Search className="h-2.5 w-2.5" />
                <span className="max-w-[110px] truncate">"{searchQuery}"</span>
                <button
                  onClick={() => onSearchChange('')}
                  className="hover:bg-muted/80 rounded-full p-0.5 -mr-1"
                  aria-label="Clear search"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
          <button
            onClick={onClearFilters}
            className="text-[11px] text-primary hover:underline font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
