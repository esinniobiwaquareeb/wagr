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
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      {(selectedCategory || searchQuery) && (
        <>
          {selectedCategory && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <span className="capitalize">{selectedCategory}</span>
              <button
                onClick={() => onCategoryChange(null)}
                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                aria-label="Remove category filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              <Search className="h-3 w-3" />
              <span className="max-w-[150px] truncate">"{searchQuery}"</span>
              <button
                onClick={() => onSearchChange('')}
                className="hover:bg-muted/80 rounded-full p-0.5 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </>
      )}
      {(selectedCategory || searchQuery) && (
        <button
          onClick={onClearFilters}
          className="text-xs text-primary hover:underline font-medium"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
