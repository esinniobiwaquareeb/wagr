"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { WagerCard } from "@/components/wager-card";
import { TrendingWagers } from "@/components/trending-wagers";
import { Skeleton } from "@/components/ui/skeleton";
import { Home as HomeIcon, Loader2, Sparkles, User, Clock, CheckCircle, Plus, Search, X, SlidersHorizontal, Flame, TrendingUp, Zap } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { CreateWagerModal } from "@/components/create-wager-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { wagersApi, preferencesApi, categoriesApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Wager } from "@/lib/types/api";
import { logger } from "@/lib/logger";
import { initReferralCode, getReferralCodeFromUrl } from "@/lib/referral-utils";

interface WagerWithEntries extends Wager {
  entries_count: number;
  side_a_total?: number;
  side_b_total?: number;
}

type TabType = 'all' | 'system' | 'user' | 'expired' | 'settled';
type QuickFilter = 'none' | 'ending-soon' | 'popular' | 'new';

function WagersPageContent() {
  const [allWagers, setAllWagers] = useState<WagerWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userEntries, setUserEntries] = useState<Map<string, { amount: number; side: string }>>(new Map());
  const [preferredCategories, setPreferredCategories] = useState<string[] | null>(null);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Get tab and category from URL params
  const activeTab = (searchParams?.get('tab') as TabType) || 'all';
  const selectedCategory = searchParams?.get('category') || null;
  const searchQuery = searchParams?.get('search') || '';
  const quickFilter = (searchParams?.get('filter') as QuickFilter) || 'none';
  
  // Local state for search input and filter visibility
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize referral code detection on page load
  useEffect(() => {
    initReferralCode();
  }, []);

  // Auto-open auth modal when referral code is detected and user is not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      const referralCode = getReferralCodeFromUrl();
      if (referralCode) {
        // Small delay to ensure page is loaded
        const timer = setTimeout(() => {
          setShowAuthModal(true);
          // Clean up URL - remove ref parameter but keep code in localStorage
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.has('ref') || urlParams.has('referral')) {
            urlParams.delete('ref');
            urlParams.delete('referral');
            const newUrl = urlParams.toString() 
              ? `${window.location.pathname}?${urlParams.toString()}`
              : window.location.pathname;
            router.replace(newUrl, { scroll: false });
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [authLoading, user, searchParams, router]);

  // Helper function to check if wager is expired (memoized)
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
      // Search across all wagers
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
      // If category is selected and tab is 'all', show ALL wagers in that category (including expired/settled)
      if (activeTab === 'all' && selectedCategory) {
        // Filter all wagers by category first, then sort by deadline (earliest first)
        tabWagers = allWagers.filter(wager => {
          const categorySlug = getCategorySlug(wager.category);
          return categorySlug === selectedCategory;
        }).sort((a, b) => {
          const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return deadlineA - deadlineB;
        });
      } else if (activeTab === 'all') {
        // No category selected - show only active markets (open, non-expired)
        // Combine and sort by deadline (earliest first - most urgent)
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
    
    // Filter by category from URL params (applies to search results and non-'all' tabs)
    // Note: For 'all' tab with category, filtering is already done above
    if (selectedCategory && !(activeTab === 'all' && !searchQuery.trim()) && quickFilter === 'none') {
      tabWagers = tabWagers.filter(wager => {
        const categorySlug = getCategorySlug(wager.category);
        return categorySlug === selectedCategory;
      });
    }
    
    // Filter by user preferences (only if user has selected specific categories and not all)
    if (user && preferredCategories !== null && preferredCategories.length > 0) {
      const hasAllCategories = preferredCategories.length === allCategories.length && 
        allCategories.every(id => preferredCategories.includes(id));
      
      // Only filter if user has selected some but not all categories
      if (!hasAllCategories) {
        tabWagers = tabWagers.filter(wager => {
          const categorySlug = getCategorySlug(wager.category);
          return !categorySlug || preferredCategories.includes(categorySlug);
        });
      }
    }
    
    return tabWagers;
  }, [activeTab, systemWagers, userWagers, expiredWagers, settledWagers, searchQuery, selectedCategory, allWagers, user, preferredCategories, allCategories, isExpired, getCategorySlug, quickFilter, endingSoonWagers, popularWagers, newWagers]);

  // Calculate filtered counts for each tab (for display)
  // These counts should reflect what would be shown in each tab after category/preference filters are applied
  const filteredCounts = useMemo(() => {
    // If category is selected, calculate counts from all wagers filtered by category
    // Otherwise, use the pre-filtered arrays
    let baseWagers: WagerWithEntries[];
    
    if (selectedCategory) {
      // Filter all wagers by category first
      baseWagers = allWagers.filter(w => {
        const categorySlug = getCategorySlug(w.category);
        return categorySlug === selectedCategory;
      });
    } else {
      // No category filter - use all wagers
      baseWagers = allWagers;
    }

    // Apply user preference filter if present
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

    // Now calculate counts for each tab from the filtered base
    return {
      system: baseWagers.filter(w => w.is_system_generated === true && w.status === "OPEN" && !isExpired(w)).length,
      user: baseWagers.filter(w => w.is_system_generated !== true && w.status === "OPEN" && !isExpired(w)).length,
      expired: baseWagers.filter(w => isExpired(w)).length,
      settled: baseWagers.filter(w => w.status === "SETTLED" || w.status === "RESOLVED").length,
    };
  }, [allWagers, selectedCategory, user, preferredCategories, allCategories, getCategorySlug, isExpired]);

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: () => fetchWagers(true),
    threshold: 80,
    disabled: loading,
  });

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedWithUserRef = useRef(false);

  const fetchWagers = useCallback(async (force = false) => {
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;

    let userEntriesMap = new Map<string, { amount: number; side: string }>();
    
    // User entries will be fetched from individual wager details if needed
    // For now, we'll extract from wager entries in the response
    // TODO: Create a dedicated endpoint for user entries if needed

    try {
      setLoading(true);
      // Increased limit to 500 to show more wagers
      // Force refresh cache when force=true to get latest user entry data
      const response = await wagersApi.list({ limit: 500 }, force);
      const wagersData = response?.wagers || (Array.isArray(response) ? response : []);

      const wagersWithCounts: WagerWithEntries[] = wagersData.map((wager: any) => {
        const entryCounts = wager.entryCounts || { sideA: 0, sideB: 0, total: 0 };
        
        // Extract user entry from API response (userEntry field)
        if (user && wager.userEntry) {
          userEntriesMap.set(wager.id, {
            amount: Number(wager.userEntry.amount || 0),
            side: wager.userEntry.side || 'a',
          });
        }
        
        return {
          ...wager,
          entries_count: entryCounts.total > 0 ? Math.ceil(entryCounts.total / wager.amount) : 0,
          side_a_count: Math.ceil(entryCounts.sideA / wager.amount),
          side_b_count: Math.ceil(entryCounts.sideB / wager.amount),
          side_a_total: entryCounts.sideA,
          side_b_total: entryCounts.sideB,
          // Handle category as object or string
          category: typeof wager.category === 'object' 
            ? (wager.category?.slug || wager.category?.label || wager.category_id)
            : (wager.category || wager.category_id),
        };
      });
      
      setUserEntries(userEntriesMap);
      
      wagersWithCounts.sort((a, b) => {
        const aExpired = isExpired(a);
        const bExpired = isExpired(b);
        if (aExpired && !bExpired) return 1;
        if (!aExpired && bExpired) return -1;
        const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return deadlineA - deadlineB;
      });
      
      setAllWagers(wagersWithCounts);
    } catch (error) {
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, 'Failed to load wagers. Please try again.');
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setAllWagers([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, toast, isExpired]);

  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    // Increased debounce to 3 seconds to prevent excessive reloads
    debounceTimeoutRef.current = setTimeout(() => {
      fetchWagers(true);
    }, 3000);
  }, [fetchWagers]);

  // Store debouncedRefetch in a ref to avoid dependency issues
  const debouncedRefetchRef = useRef(debouncedRefetch);
  useEffect(() => {
    debouncedRefetchRef.current = debouncedRefetch;
  }, [debouncedRefetch]);

  useEffect(() => {
    const shouldShowLogin = searchParams?.get('login') === 'true' && !user;
    if (!user && shouldShowLogin) {
      setShowAuthModal(true);
      router.replace('/wagers', { scroll: false });
    }
  }, [user, searchParams, router]);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesApi.list(false);
        if (response && response.categories) {
          const categorySlugs = response.categories
            .filter(cat => cat.is_active)
            .map(cat => cat.slug);
          setAllCategories(categorySlugs);
        }
      } catch (error) {
        logger.error('Error fetching categories', error);
        // Fallback to empty array
        setAllCategories([]);
      }
    };

    fetchCategories();
  }, []);

  // Fetch user preferences for category filtering
  useEffect(() => {
    if (!user) {
      setPreferredCategories(null);
      return;
    }

    const fetchPreferences = async () => {
      try {
        const response = await preferencesApi.get();
        const categories = response.preferences?.preferred_categories || [];
        setPreferredCategories(categories);
      } catch (error) {
        logger.error('Error fetching preferences', error);
        // Silently fail - preferences are optional, don't show error toast
        setPreferredCategories(null);
      }
    };

    fetchPreferences();
  }, [user]);

  useEffect(() => {
    // Reset flag when user logs out
    if (!user) {
      hasFetchedWithUserRef.current = false;
    }

    // Wait for auth to finish loading before fetching
    if (authLoading) {
      return;
    }

    // If user just loaded and we haven't fetched with user data yet, fetch now
    if (user && !hasFetchedWithUserRef.current) {
      hasFetchedWithUserRef.current = true;
      fetchWagers(true); // Force refresh to get user entries
    } else {
      // Initial fetch (when no user) or re-fetch when user changes
      fetchWagers();
    }

    // Listen for wager update events from card components
    const handleWagerUpdate = () => {
      // Immediately refresh to get updated user entry data
      fetchWagers(true);
    };
    window.addEventListener('wager-updated', handleWagerUpdate);
    window.addEventListener('balance-updated', handleWagerUpdate);

    return () => {
      window.removeEventListener('wager-updated', handleWagerUpdate);
      window.removeEventListener('balance-updated', handleWagerUpdate);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [user, fetchWagers, authLoading]);

  const handleTabChange = (tab: TabType) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (tab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.push(`/wagers?${params.toString()}`, { scroll: false });
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
    // Debounce search to avoid too many URL updates
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      if (value.trim()) {
        params.set('search', value.trim());
      } else {
        params.delete('search');
      }
      router.push(`/wagers?${params.toString()}`, { scroll: false });
    }, 300);
  };

  const handleCategoryChange = (category: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (category) {
      params.set('category', category);
    } else {
      params.delete('category');
    }
    router.push(`/wagers?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    setLocalSearchQuery('');
    router.push('/wagers', { scroll: false });
  };

  const handleQuickFilterChange = (filter: QuickFilter) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    // Clear tab when applying quick filter
    params.delete('tab');
    if (filter === 'none') {
      params.delete('filter');
    } else {
      params.set('filter', filter);
    }
    router.push(`/wagers?${params.toString()}`, { scroll: false });
  };

      return (
    <main className="flex-1 pb-24 lg:pb-0 relative w-full overflow-x-hidden">
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-4 pointer-events-none">
          <div className="bg-primary/90 backdrop-blur-sm text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Refreshing...</span>
              </>
            ) : (
                <span className="text-sm font-medium">Pull to refresh</span>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 lg:py-8">
        {/* Mobile Header */}
        <div className="lg:hidden mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">Markets</h1>
              <p className="text-xs text-muted-foreground">
                {filteredWagers.length} {filteredWagers.length === 1 ? 'wager' : 'wagers'} available
              </p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                showFilters || selectedCategory || searchQuery
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {(selectedCategory || searchQuery) && (
                <span className="bg-primary-foreground/20 px-1.5 py-0.5 rounded text-xs">
                  {[selectedCategory, searchQuery].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Search & Filters (collapsible) */}
          {showFilters && (
            <div className="space-y-3 mb-4 p-3 bg-muted/30 rounded-xl border border-border/50">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={localSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {localSearchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              
              {/* Category Pills */}
              {allCategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleCategoryChange(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      !selectedCategory
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All
                  </button>
                  {allCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleCategoryChange(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Clear Filters */}
              {(selectedCategory || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Trending Wagers Section - Show when no filters are active */}
        {quickFilter === 'none' && !selectedCategory && !searchQuery && activeTab === 'all' && (
          <div className="mb-6">
            <TrendingWagers />
          </div>
        )}

        {/* Quick Filter Tags (Polymarket-style) - Both Mobile & Desktop */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-1 px-1">
          <button
            onClick={() => handleQuickFilterChange('none')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              quickFilter === 'none' && activeTab === 'all'
                ? 'bg-foreground text-background'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            All Markets
          </button>
          <button
            onClick={() => handleQuickFilterChange('ending-soon')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              quickFilter === 'ending-soon'
                ? 'bg-red-500 text-white'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Ending Soon
            {endingSoonWagers.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                quickFilter === 'ending-soon' ? 'bg-white/20' : 'bg-red-500/20'
              }`}>{endingSoonWagers.length}</span>
            )}
          </button>
          <button
            onClick={() => handleQuickFilterChange('popular')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              quickFilter === 'popular'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Popular
          </button>
          <button
            onClick={() => handleQuickFilterChange('new')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              quickFilter === 'new'
                ? 'bg-emerald-500 text-white'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            New
            {newWagers.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                quickFilter === 'new' ? 'bg-white/20' : 'bg-emerald-500/20'
              }`}>{newWagers.length}</span>
            )}
          </button>
        </div>

        {/* Mobile: Tab Navigation - Now with 5 tabs including All */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide -mx-1 px-1">
          <button
            onClick={() => handleTabChange('all')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <HomeIcon className="h-4 w-4" />
            <span className="text-xs font-medium">All</span>
          </button>
          <button
            onClick={() => handleTabChange('system')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
              activeTab === 'system'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium">System</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              activeTab === 'system' ? 'bg-primary-foreground/20' : 'bg-background'
            }`}>{filteredCounts.system}</span>
          </button>
          <button
            onClick={() => handleTabChange('user')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
              activeTab === 'user'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <User className="h-4 w-4" />
            <span className="text-xs font-medium">Community</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              activeTab === 'user' ? 'bg-primary-foreground/20' : 'bg-background'
            }`}>{filteredCounts.user}</span>
          </button>
          <button
            onClick={() => handleTabChange('expired')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
              activeTab === 'expired'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Ended</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              activeTab === 'expired' ? 'bg-primary-foreground/20' : 'bg-background'
            }`}>{filteredCounts.expired}</span>
          </button>
          <button
            onClick={() => handleTabChange('settled')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
              activeTab === 'settled'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Settled</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              activeTab === 'settled' ? 'bg-primary-foreground/20' : 'bg-background'
            }`}>{filteredCounts.settled}</span>
          </button>
        </div>

        {/* Desktop: Sleek Tab Navigation with Stats */}
        <div className="hidden lg:block mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Active Markets</h1>
              <p className="text-sm text-muted-foreground">
                {filteredWagers.length} {filteredWagers.length === 1 ? 'wager' : 'wagers'} available
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Desktop Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={localSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-64 pl-10 pr-10 py-2 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-background transition-all"
                />
                {localSearchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                if (!user) {
                  setShowAuthModal(true);
                } else {
                  setShowCreateModal(true);
                }
                }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
              <Plus className="h-4 w-4" />
              <span>Create Market</span>
              </button>
            </div>
        </div>

          {/* Active filters indicator for desktop */}
          {(selectedCategory || searchQuery) && (
            <div className="flex items-center gap-2 mb-4">
              {selectedCategory && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <span className="capitalize">{selectedCategory}</span>
                  <button 
                    onClick={() => handleCategoryChange(null)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                  <Search className="h-3 w-3" />
                  <span>"{searchQuery}"</span>
                  <button 
                    onClick={() => handleSearchChange('')}
                    className="hover:bg-muted/80 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Sleek Tab Bar */}
          <div className="flex items-center gap-1 bg-muted/30 backdrop-blur-sm rounded-xl p-1 border border-border/50">
            <button
              onClick={() => handleTabChange('all')}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] group ${
                activeTab === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <HomeIcon className="h-4 w-4" />
              <span>All</span>
              {activeTab === 'all' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
            <button
              onClick={() => handleTabChange('system')}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] group ${
                activeTab === 'system'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>System</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'system'
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {filteredCounts.system}
              </span>
              {activeTab === 'system' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
            <button
              onClick={() => handleTabChange('user')}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] group ${
                activeTab === 'user'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Community</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'user'
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {filteredCounts.user}
              </span>
              {activeTab === 'user' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
            <button
              onClick={() => handleTabChange('expired')}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] group ${
                activeTab === 'expired'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Ended</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'expired'
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {filteredCounts.expired}
              </span>
              {activeTab === 'expired' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
            <button
              onClick={() => handleTabChange('settled')}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] group ${
                activeTab === 'settled'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              <span>Settled</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'settled'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {filteredCounts.settled}
              </span>
              {activeTab === 'settled' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Wager Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 lg:p-5">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredWagers.length === 0 ? (
          <div className="text-center py-20 lg:py-24 bg-card border border-border rounded-xl lg:rounded-2xl">
            <div className="max-w-md mx-auto px-4">
              <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <HomeIcon className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold mb-3">No wagers found</h3>
              <p className="text-sm lg:text-base text-muted-foreground mb-6">
                {searchQuery ? "Try a different search term" : "Be the first to create a market!"}
              </p>
              <button
                onClick={() => {
                  if (!user) {
                    setShowAuthModal(true);
                  } else {
                    setShowCreateModal(true);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-all active:scale-95 touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] shadow-sm hover:shadow-md"
              >
                <span className="text-lg">+</span>
                <span>Create Market</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredWagers.map((wager) => (
              <WagerCard
                key={wager.id}
                id={wager.id}
                title={wager.title}
                sideA={wager.side_a}
                sideB={wager.side_b}
                amount={wager.amount}
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
              />
            ))}
          </div>
        )}
      </div>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
        }}
      />
      {user && (
        <CreateWagerModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={() => {
            fetchWagers(true);
          }}
        />
      )}
    </main>
  );
}

export default function WagersPage() {
  return (
    <Suspense fallback={
      <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    }>
      <WagersPageContent />
    </Suspense>
  );
}
