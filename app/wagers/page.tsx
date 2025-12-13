"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { WagerCard } from "@/components/wager-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Home as HomeIcon, Loader2, Sparkles, User, Clock, CheckCircle } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { CreateWagerModal } from "@/components/create-wager-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_FEE_PERCENTAGE, WAGER_CATEGORIES } from "@/lib/constants";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { wagersApi, preferencesApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Wager } from "@/lib/types/api";

interface WagerWithEntries extends Wager {
  entries_count: number;
  side_a_total?: number;
  side_b_total?: number;
}

type TabType = 'all' | 'system' | 'user' | 'expired' | 'settled';

function WagersPageContent() {
  const [allWagers, setAllWagers] = useState<WagerWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userEntries, setUserEntries] = useState<Map<string, { amount: number; side: string }>>(new Map());
  const [preferredCategories, setPreferredCategories] = useState<string[] | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Get tab and category from URL params
  const activeTab = (searchParams?.get('tab') as TabType) || 'all';
  const selectedCategory = searchParams?.get('category') || null;
  const searchQuery = searchParams?.get('search') || '';

  // Helper function to check if wager is expired (memoized)
  const isExpired = useCallback((wager: WagerWithEntries) => {
    if (!wager.deadline || wager.status !== "OPEN") return false;
    return new Date(wager.deadline).getTime() < Date.now();
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

  // Filter wagers based on active tab, search, and category
  const filteredWagers = useMemo(() => {
    let tabWagers: WagerWithEntries[];
    
    // If there's a search query, search across ALL wagers first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      // Search across all wagers
      const searchResults = allWagers.filter(wager => 
        wager.title.toLowerCase().includes(query) ||
        wager.description?.toLowerCase().includes(query) ||
        wager.side_a.toLowerCase().includes(query) ||
        wager.side_b.toLowerCase().includes(query) ||
        wager.category?.toLowerCase().includes(query) ||
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
      if (activeTab === 'all') {
        tabWagers = [...systemWagers, ...userWagers];
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
    
    // Filter by category from URL params (applies to both search results and normal tab results)
    if (selectedCategory) {
      tabWagers = tabWagers.filter(wager => wager.category === selectedCategory);
    }
    
    // Filter by user preferences (only if user has selected specific categories and not all)
    if (user && preferredCategories !== null && preferredCategories.length > 0) {
      const allCategoryIds = WAGER_CATEGORIES.map(cat => cat.id);
      const hasAllCategories = preferredCategories.length === allCategoryIds.length && 
        allCategoryIds.every(id => preferredCategories.includes(id));
      
      // Only filter if user has selected some but not all categories
      if (!hasAllCategories) {
        tabWagers = tabWagers.filter(wager => 
          !wager.category || preferredCategories.includes(wager.category)
        );
      }
    }
    
    return tabWagers;
  }, [activeTab, systemWagers, userWagers, expiredWagers, settledWagers, searchQuery, selectedCategory, allWagers, user, preferredCategories, isExpired]);

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: () => fetchWagers(true),
    threshold: 80,
    disabled: loading,
  });

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      const response = await wagersApi.list({ limit: 500 });
      const wagersData = response?.wagers || (Array.isArray(response) ? response : []);

      const wagersWithCounts: WagerWithEntries[] = wagersData.map((wager: any) => {
        const entryCounts = wager.entryCounts || { sideA: 0, sideB: 0, total: 0 };
        
        // Extract user entry from wager entries if available
        if (user && wager.entries) {
          const userEntry = wager.entries.sideA?.find((e: any) => e.user_id === user.id) ||
                          wager.entries.sideB?.find((e: any) => e.user_id === user.id);
          if (userEntry) {
            const existing = userEntriesMap.get(wager.id);
            if (existing) {
              userEntriesMap.set(wager.id, {
                amount: existing.amount + Number(userEntry.amount || 0),
                side: userEntry.side || existing.side,
              });
            } else {
              userEntriesMap.set(wager.id, {
                amount: Number(userEntry.amount || 0),
                side: userEntry.side || 'a',
              });
            }
          }
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Error",
        description: `Failed to load wagers: ${errorMessage}`,
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
        console.error('Error fetching preferences:', error);
        // Silently fail - preferences are optional, don't show error toast
        setPreferredCategories(null);
      }
    };

    fetchPreferences();
  }, [user]);

  useEffect(() => {
    fetchWagers();

    // Poll for updates every 30 seconds (replaces real-time subscriptions)
    const pollInterval = setInterval(() => {
      fetchWagers(true);
    }, 30000);

    // Listen for wager update events from card components
    const handleWagerUpdate = () => {
      debouncedRefetchRef.current();
    };
    window.addEventListener('wager-updated', handleWagerUpdate);
    window.addEventListener('balance-updated', handleWagerUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('wager-updated', handleWagerUpdate);
      window.removeEventListener('balance-updated', handleWagerUpdate);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [user, fetchWagers, debouncedRefetch]);

  const handleTabChange = (tab: TabType) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (tab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
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

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 lg:py-8">
        {/* Mobile: Grid Layout with Icons */}
        <div className="lg:hidden grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => handleTabChange('system')}
            className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeTab === 'system'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-medium">System</span>
            <span className="text-xs font-semibold">{systemWagers.length}</span>
          </button>
          <button
            onClick={() => handleTabChange('user')}
            className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeTab === 'user'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Community</span>
            <span className="text-xs font-semibold">{userWagers.length}</span>
          </button>
          <button
            onClick={() => handleTabChange('expired')}
            className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeTab === 'expired'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <Clock className="h-5 w-5" />
            <span className="text-xs font-medium">Ended</span>
            <span className="text-xs font-semibold">{expiredWagers.length}</span>
          </button>
          <button
            onClick={() => handleTabChange('settled')}
            className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeTab === 'settled'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <CheckCircle className="h-5 w-5" />
            <span className="text-xs font-medium">Settled</span>
            <span className="text-xs font-semibold">{settledWagers.length}</span>
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
            {user && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <span className="text-lg">+</span>
                <span>Create Market</span>
              </button>
            )}
          </div>
          
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
                {systemWagers.length}
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
                {userWagers.length}
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
                {expiredWagers.length}
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
                {settledWagers.length}
              </span>
              {activeTab === 'settled' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Wager Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
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
              {user && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-all active:scale-95 touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] shadow-sm hover:shadow-md"
                >
                  <span className="text-lg">+</span>
                  <span>Create Market</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {filteredWagers.map((wager) => (
            <WagerCard
              key={`${wager.id}-${activeTab}-${userEntries.get(wager.id)?.side || 'none'}`}
              id={wager.id}
              title={wager.title}
              description={wager.description || ""}
              sideA={wager.side_a}
              sideB={wager.side_b}
              amount={wager.amount}
              status={wager.status}
              entriesCount={wager.entries_count}
              deadline={wager.deadline}
              currency={wager.currency}
              category={wager.category}
              sideACount={wager.side_a_count || 0}
              sideBCount={wager.side_b_count || 0}
              sideATotal={wager.side_a_total || 0}
              sideBTotal={wager.side_b_total || 0}
              feePercentage={wager.fee_percentage || PLATFORM_FEE_PERCENTAGE}
              isSystemGenerated={wager.is_system_generated || false}
              createdAt={wager.created_at}
              winningSide={wager.winning_side}
              shortId={wager.short_id}
              userEntryAmount={userEntries.get(wager.id)?.amount}
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
