import { useMemo, useCallback } from "react";

export interface WagerWithEntries {
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
  created_at?: string;
  category?: any;
  side_a_total?: number;
  side_b_total?: number;
  is_system_generated?: boolean;
  winning_side?: string | null;
  short_id?: string | null;
  marketLiquidity?: any;
  description?: string;
  tags?: string[];
}

export type TabType = 'all' | 'system' | 'user' | 'expired' | 'settled';
export type QuickFilter = 'none' | 'ending-soon' | 'popular' | 'new';

export function useWagerFilters(
  allWagers: WagerWithEntries[],
  activeTab: TabType,
  searchQuery: string,
  selectedCategory: string | null,
  quickFilter: QuickFilter,
  preferredCategories: string[] | null,
  allCategories: string[],
  user: any
) {
  // Helper function to check if wager is expired
  const isExpired = useCallback((wager: WagerWithEntries) => {
    if (!wager.deadline || wager.status !== "OPEN") return false;
    return new Date(wager.deadline).getTime() < Date.now();
  }, []);

  // Helper function to extract category slug consistently
  const getCategorySlug = useCallback((category: any): string | null => {
    if (!category) return null;
    if (typeof category === 'string') return category;
    if (typeof category === 'object') {
      return category.slug || category.label || category.id || null;
    }
    return null;
  }, []);

  // Separate wagers by type
  const systemWagers = useMemo(() => {
    const filtered = allWagers.filter(w =>
      w.is_system_generated === true &&
      w.status === "OPEN" &&
      !isExpired(w)
    );
    return filtered.sort((a, b) => {
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return deadlineA - deadlineB;
    });
  }, [allWagers, isExpired]);

  const userWagers = useMemo(() => {
    const filtered = allWagers.filter(w =>
      w.is_system_generated !== true &&
      w.status === "OPEN" &&
      !isExpired(w)
    );
    return filtered.sort((a, b) => {
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return deadlineA - deadlineB;
    });
  }, [allWagers, isExpired]);

  const expiredWagers = useMemo(() => {
    return allWagers.filter(w => isExpired(w)).sort((a, b) => {
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : 0;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : 0;
      return deadlineB - deadlineA;
    });
  }, [allWagers, isExpired]);

  const settledWagers = useMemo(() => {
    return allWagers.filter(w => w.status === "SETTLED" || w.status === "RESOLVED").sort((a, b) => {
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : 0;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : 0;
      return deadlineB - deadlineA;
    });
  }, [allWagers]);

  // Quick filter: Ending Soon (deadline within 24 hours)
  const endingSoonWagers = useMemo(() => {
    const now = Date.now();
    const in24Hours = now + 24 * 60 * 60 * 1000;
    return allWagers.filter(w => {
      if (!w.deadline || w.status !== "OPEN" || isExpired(w)) return false;
      const deadline = new Date(w.deadline).getTime();
      return deadline > now && deadline <= in24Hours;
    }).sort((a, b) => {
      const deadlineA = new Date(a.deadline!).getTime();
      const deadlineB = new Date(b.deadline!).getTime();
      return deadlineA - deadlineB;
    });
  }, [allWagers, isExpired]);

  // Quick filter: Popular (most participants/volume)
  const popularWagers = useMemo(() => {
    return allWagers
      .filter(w => w.status === "OPEN" && !isExpired(w))
      .sort((a, b) => {
        const aVolume = (a.side_a_total || 0) + (a.side_b_total || 0);
        const bVolume = (b.side_a_total || 0) + (b.side_b_total || 0);
        return bVolume - aVolume;
      })
      .slice(0, 20);
  }, [allWagers, isExpired]);

  // Quick filter: New (created in last 24 hours)
  const newWagers = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return allWagers
      .filter(w => {
        if (w.status !== "OPEN" || isExpired(w)) return false;
        const createdAt = w.created_at ? new Date(w.created_at).getTime() : 0;
        return createdAt >= oneDayAgo;
      })
      .sort((a, b) => {
        const aCreated = new Date(a.created_at || 0).getTime();
        const bCreated = new Date(b.created_at || 0).getTime();
        return bCreated - aCreated;
      });
  }, [allWagers, isExpired]);

  // Filter wagers based on active tab, search, and category
  const filteredWagers = useMemo(() => {
    let tabWagers: WagerWithEntries[];

    // Quick filters take precedence
    if (quickFilter !== 'none') {
      if (quickFilter === 'ending-soon') {
        tabWagers = endingSoonWagers;
      } else if (quickFilter === 'popular') {
        tabWagers = popularWagers;
      } else if (quickFilter === 'new') {
        tabWagers = newWagers;
      } else {
        tabWagers = [...systemWagers, ...userWagers];
      }
    }
    // If there's a search query, search across ALL wagers first
    else if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const searchResults = allWagers.filter(wager =>
        wager.title.toLowerCase().includes(query) ||
        wager.description?.toLowerCase().includes(query) ||
        wager.side_a.toLowerCase().includes(query) ||
        wager.side_b.toLowerCase().includes(query) ||
        (() => {
          const categorySlug = getCategorySlug(wager.category);
          if (!categorySlug) return false;
          return categorySlug.toLowerCase().includes(query);
        })() ||
        wager.tags?.some(tag => tag.toLowerCase().includes(query))
      );

      // Then apply tab filter
      if (activeTab === 'all') {
        tabWagers = searchResults;
      } else if (activeTab === 'system') {
        tabWagers = searchResults.filter(w => w.is_system_generated === true);
      } else if (activeTab === 'user') {
        tabWagers = searchResults.filter(w => w.is_system_generated !== true);
      } else if (activeTab === 'expired') {
        tabWagers = searchResults.filter(w => isExpired(w));
      } else {
        tabWagers = searchResults.filter(w => w.status === "SETTLED" || w.status === "RESOLVED");
      }
    } else {
      // No search query - use normal tab filtering
      if (activeTab === 'all' && selectedCategory) {
        tabWagers = allWagers.filter(wager => {
          const categorySlug = getCategorySlug(wager.category);
          return categorySlug === selectedCategory;
        }).sort((a, b) => {
          const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return deadlineA - deadlineB;
        });
      } else if (activeTab === 'all') {
        tabWagers = [...systemWagers, ...userWagers].sort((a, b) => {
          const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return deadlineA - deadlineB;
        });
      } else if (activeTab === 'system') {
        tabWagers = systemWagers;
      } else if (activeTab === 'user') {
        tabWagers = userWagers;
      } else if (activeTab === 'expired') {
        tabWagers = expiredWagers;
      } else {
        tabWagers = settledWagers;
      }
    }

    // Filter by category from URL params
    if (selectedCategory && !(activeTab === 'all' && !searchQuery.trim()) && quickFilter === 'none') {
      tabWagers = tabWagers.filter(wager => {
        const categorySlug = getCategorySlug(wager.category);
        return categorySlug === selectedCategory;
      });
    }

    // Filter by user preferences
    if (user && preferredCategories !== null && preferredCategories.length > 0) {
      const hasAllCategories = preferredCategories.length === allCategories.length &&
        allCategories.every(id => preferredCategories.includes(id));

      if (!hasAllCategories) {
        tabWagers = tabWagers.filter(wager => {
          const categorySlug = getCategorySlug(wager.category);
          return !categorySlug || preferredCategories.includes(categorySlug);
        });
      }
    }

    return tabWagers;
  }, [
    activeTab,
    systemWagers,
    userWagers,
    expiredWagers,
    settledWagers,
    searchQuery,
    selectedCategory,
    allWagers,
    user,
    preferredCategories,
    allCategories,
    isExpired,
    getCategorySlug,
    quickFilter,
    endingSoonWagers,
    popularWagers,
    newWagers,
  ]);

  // Calculate filtered counts for each tab
  const filteredCounts = useMemo(() => {
    let baseWagers: WagerWithEntries[];

    if (selectedCategory) {
      baseWagers = allWagers.filter(w => {
        const categorySlug = getCategorySlug(w.category);
        return categorySlug === selectedCategory;
      });
    } else {
      baseWagers = allWagers;
    }

    if (user && preferredCategories !== null && preferredCategories.length > 0) {
      const hasAllCategories = preferredCategories.length === allCategories.length &&
        allCategories.every(id => preferredCategories.includes(id));

      if (!hasAllCategories) {
        baseWagers = baseWagers.filter(w => {
          const categorySlug = getCategorySlug(w.category);
          return !categorySlug || preferredCategories.includes(categorySlug);
        });
      }
    }

    return {
      system: baseWagers.filter(w => w.is_system_generated === true && w.status === "OPEN" && !isExpired(w)).length,
      user: baseWagers.filter(w => w.is_system_generated !== true && w.status === "OPEN" && !isExpired(w)).length,
      expired: baseWagers.filter(w => isExpired(w)).length,
      settled: baseWagers.filter(w => w.status === "SETTLED" || w.status === "RESOLVED").length,
    };
  }, [allWagers, selectedCategory, user, preferredCategories, allCategories, getCategorySlug, isExpired]);

  return {
    filteredWagers,
    filteredCounts,
    endingSoonWagers,
    popularWagers,
    newWagers,
    getCategorySlug,
  };
}
