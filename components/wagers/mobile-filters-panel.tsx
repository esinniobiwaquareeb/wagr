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
    <div className="space-y-3 p-3 bg-card border border-border rounded-xl shadow-sm">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      {allCategories.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Categories</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onCategoryChange(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
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
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedCategory && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <span className="capitalize">{selectedCategory}</span>
                <button
                  onClick={() => onCategoryChange(null)}
                  className="hover:bg-primary/20 rounded-full p-0.5 -mr-1"
                  aria-label="Remove category filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                <Search className="h-3 w-3" />
                <span className="max-w-[120px] truncate">"{searchQuery}"</span>
                <button
                  onClick={() => onSearchChange('')}
                  className="hover:bg-muted/80 rounded-full p-0.5 -mr-1"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          <button
            onClick={onClearFilters}
            className="text-xs text-primary hover:underline font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
