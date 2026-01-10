"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { TrendingWagers } from "@/components/trending-wagers";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { CreateWagerModal } from "@/components/create-wager-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { wagersApi, preferencesApi, categoriesApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { initReferralCode, getReferralCodeFromUrl } from "@/lib/referral-utils";
import { MobileHeader } from "@/components/wagers/mobile-header";
import { MobileFiltersPanel } from "@/components/wagers/mobile-filters-panel";
import { DesktopHeader } from "@/components/wagers/desktop-header";
import { ActiveFilters } from "@/components/wagers/active-filters";
import { TabNavigation, type TabType, type QuickFilter } from "@/components/wagers/tab-navigation";
import { WagerGrid } from "@/components/wagers/wager-grid";
import { useWagerFilters, type WagerWithEntries } from "@/hooks/use-wager-filters";

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

  // Use custom hook for filtering logic
  const {
    filteredWagers,
    filteredCounts,
    endingSoonWagers,
    popularWagers,
    newWagers,
    getCategorySlug,
  } = useWagerFilters(
    allWagers,
    activeTab,
    searchQuery,
    selectedCategory,
    quickFilter,
    preferredCategories,
    allCategories,
    user
  );

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
      // Request 200 wagers: backend will return 100 open wagers (prioritized) + 100 other wagers
      // Force refresh cache when force=true to get latest user entry data
      const response = await wagersApi.list({ limit: 200 }, force);
      const wagersData = response?.wagers || (Array.isArray(response) ? response : []);

      const wagersWithCounts: WagerWithEntries[] = wagersData.map((wager: any) => {
        const entryCounts = wager.entryCounts || { sideA: 0, sideB: 0, total: 0 };
        const marketLiquidity = wager.marketLiquidity;
        
        // Extract user entry from API response (userEntry field)
        if (user && wager.userEntry) {
          userEntriesMap.set(wager.id, {
            amount: Number(wager.userEntry.amount || 0),
            side: wager.userEntry.side || 'a',
          });
        }
        
        // Calculate participant count correctly:
        // Use marketLiquidity participant counts if available (most accurate)
        // Otherwise, we need to count distinct entries (not divide amounts)
        let participantCount = 0;
        if (marketLiquidity) {
          participantCount = (marketLiquidity.sideAParticipants || 0) + (marketLiquidity.sideBParticipants || 0);
        } else {
          // Fallback: if we don't have marketLiquidity, we can't accurately count participants
          // from entryCounts alone (which are amounts, not counts)
          // Set to 0 to avoid showing incorrect data
          participantCount = 0;
        }
        
        return {
          ...wager,
          entries_count: participantCount,
          side_a_count: marketLiquidity?.sideAParticipants || 0,
          side_b_count: marketLiquidity?.sideBParticipants || 0,
          side_a_total: entryCounts.sideA,
          side_b_total: entryCounts.sideB,
          // Handle category as object or string
          category: typeof wager.category === 'object' 
            ? (wager.category?.slug || wager.category?.label || wager.category_id)
            : (wager.category || wager.category_id),
          // Include market liquidity data if available
          marketLiquidity: marketLiquidity,
        };
      });
      
      setUserEntries(userEntriesMap);
      
      // Helper to check if wager is expired (for sorting)
      const isExpired = (w: WagerWithEntries) => {
        if (!w.deadline || w.status !== "OPEN") return false;
        return new Date(w.deadline).getTime() < Date.now();
      };

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
  }, [user, toast]);

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
      // Clear quick filter when clicking "All" to reset to default view
      params.delete('filter');
    } else {
      params.set('tab', tab);
      // Clear quick filter when switching to a specific tab
      params.delete('filter');
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
    // Keep current tab when applying quick filter
    if (filter === 'none') {
      params.delete('filter');
    } else {
      params.set('filter', filter);
      // Set tab to 'all' when using quick filters for better UX
      if (activeTab !== 'all') {
        params.delete('tab');
      }
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 lg:py-4">
        {/* Mobile Header */}
        <MobileHeader
          wagerCount={filteredWagers.length}
          hasActiveFilters={showFilters || !!selectedCategory || !!searchQuery}
          onCreateClick={() => {
            if (!user) {
              setShowAuthModal(true);
            } else {
              setShowCreateModal(true);
            }
          }}
          onFilterToggle={() => setShowFilters(!showFilters)}
          filterCount={[selectedCategory, searchQuery].filter(Boolean).length}
        />

        {/* Mobile Filters Panel */}
        <MobileFiltersPanel
          isOpen={showFilters}
          searchQuery={localSearchQuery}
          onSearchChange={handleSearchChange}
          selectedCategory={selectedCategory}
          allCategories={allCategories}
          onCategoryChange={handleCategoryChange}
          onClearFilters={clearFilters}
        />

        {/* Trending Wagers Section - Show when no filters are active */}
        {quickFilter === 'none' && !selectedCategory && !searchQuery && activeTab === 'all' && (
          <div className="mb-4 lg:mb-5">
            <TrendingWagers />
          </div>
        )}

        {/* Mobile Tab Navigation */}
        <TabNavigation
          variant="mobile"
          activeTab={activeTab}
          quickFilter={quickFilter}
          filteredCounts={filteredCounts}
          endingSoonCount={endingSoonWagers.length}
          newWagersCount={newWagers.length}
          onTabChange={handleTabChange}
          onQuickFilterChange={handleQuickFilterChange}
        />

        {/* Desktop Header */}
        <DesktopHeader
          wagerCount={filteredWagers.length}
          searchQuery={localSearchQuery}
          onSearchChange={handleSearchChange}
          selectedCategory={selectedCategory}
          allCategories={allCategories}
          onCategoryChange={handleCategoryChange}
          onCreateClick={() => {
            if (!user) {
              setShowAuthModal(true);
            } else {
              setShowCreateModal(true);
            }
          }}
        />

        {/* Active Filters */}
        <div className="hidden lg:block">
          <ActiveFilters
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
            quickFilter={quickFilter}
            onCategoryChange={handleCategoryChange}
            onSearchChange={handleSearchChange}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Desktop Tab Navigation */}
        <div className="hidden lg:block">
          <TabNavigation
            variant="desktop"
            activeTab={activeTab}
            quickFilter={quickFilter}
            filteredCounts={filteredCounts}
            endingSoonCount={endingSoonWagers.length}
            newWagersCount={newWagers.length}
            onTabChange={handleTabChange}
            onQuickFilterChange={handleQuickFilterChange}
          />
        </div>

        {/* Wager Grid */}
        <WagerGrid
          loading={loading}
          wagers={filteredWagers}
          userEntries={userEntries}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onClearFilters={clearFilters}
          onCreateClick={() => {
            if (!user) {
              setShowAuthModal(true);
            } else {
              setShowCreateModal(true);
            }
          }}
          getCategorySlug={getCategorySlug}
        />
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
