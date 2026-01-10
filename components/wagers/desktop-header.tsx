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
    <div className="hidden lg:block mb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold mb-1">Active Markets</h1>
          <p className="text-sm text-muted-foreground">
            {wagerCount} {wagerCount === 1 ? 'market' : 'markets'} available
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Desktop Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-64 pl-10 pr-10 py-2.5 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-background focus:border-primary/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          {/* Desktop Category Filter */}
          {allCategories.length > 0 && (
            <div className="relative">
              <select
                value={selectedCategory || ''}
                onChange={(e) => onCategoryChange(e.target.value || null)}
                className="appearance-none pl-4 pr-8 py-2.5 bg-muted/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-background focus:border-primary/50 transition-all cursor-pointer min-w-[130px]"
              >
                <option value="">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat} className="capitalize">
                    {cat}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          )}
          <button
            onClick={onCreateClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 hover:shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create</span>
          </button>
        </div>
      </div>
    </div>
  );
}
