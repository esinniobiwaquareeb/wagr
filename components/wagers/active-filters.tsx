"use client";

import { Search, X } from "lucide-react";

interface ActiveFiltersProps {
  selectedCategory: string | null;
  searchQuery: string;
  quickFilter: string;
  onCategoryChange: (category: string | null) => void;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
}

export function ActiveFilters({
  selectedCategory,
  searchQuery,
  quickFilter,
  onCategoryChange,
  onSearchChange,
  onClearFilters,
}: ActiveFiltersProps) {
  const hasFilters = selectedCategory || searchQuery || quickFilter !== 'none';
  
  if (!hasFilters) return null;

  return (
    <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
      {(selectedCategory || searchQuery) && (
        <>
          {selectedCategory && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <span className="capitalize">{selectedCategory}</span>
              <button
                onClick={() => onCategoryChange(null)}
                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                aria-label="Remove category filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              <Search className="h-2.5 w-2.5" />
              <span className="max-w-[140px] truncate">"{searchQuery}"</span>
              <button
                onClick={() => onSearchChange('')}
                className="hover:bg-muted/80 rounded-full p-0.5 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
        </>
      )}
      {(selectedCategory || searchQuery) && (
        <button
          onClick={onClearFilters}
          className="text-[11px] text-primary hover:underline font-medium"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
