"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { WagerCard } from "@/components/wager-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Home as HomeIcon, Plus, Search, Sparkles, Users, X, Tag, Filter, Loader2 } from "lucide-react";
import Link from "next/link";
import { AuthModal } from "@/components/auth-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_FEE_PERCENTAGE, WAGER_CATEGORIES } from "@/lib/constants";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

interface Wager {
  id: string;
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  status: string;
  deadline: string;
  created_at?: string;
  currency?: string;
  category?: string;
  tags?: string[];
  is_system_generated?: boolean;
  is_public?: boolean;
  fee_percentage?: number;
}

interface WagerWithEntries extends Wager {
  entries_count: number;
  side_a_count?: number;
  side_b_count?: number;
  side_a_total?: number;
  side_b_total?: number;
}

type TabType = 'system' | 'user' | 'expired' | 'settled';

function WagersPageContent() {
  const [wagers, setWagers] = useState<WagerWithEntries[]>([]);
  const [allWagers, setAllWagers] = useState<WagerWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('system');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, loading: authLoading, supabase } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // A/B Testing - Layout variant (client-side only to prevent hydration mismatch)
  const [layoutVariant, setLayoutVariant] = useState<'A' | 'B'>('A');
  
  useEffect(() => {
    setMounted(true);
    setLayoutVariant(getVariant(AB_TESTS.WAGERS_PAGE_LAYOUT));
  }, []);

  // Helper function to check if wager is expired
  const isExpired = (wager: WagerWithEntries) => {
    if (!wager.deadline || wager.status !== "OPEN") return false;
    return new Date(wager.deadline).getTime() < Date.now();
  };

  // Separate wagers by type and sort by deadline (earliest first, expired last)
  const systemWagers = useMemo(() => {
    const filtered = allWagers.filter(w => w.is_system_generated === true);
    return filtered.sort((a, b) => {
      const aExpired = isExpired(a);
      const bExpired = isExpired(b);
      
      // Expired wagers go to the end
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;
      
      // Both expired or both not expired - sort by deadline
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return deadlineA - deadlineB; // Earliest deadline first
    });
  }, [allWagers]);

  const userWagers = useMemo(() => {
    const filtered = allWagers.filter(w => w.is_system_generated !== true);
    return filtered.sort((a, b) => {
      const aExpired = isExpired(a);
      const bExpired = isExpired(b);
      
      // Expired wagers go to the end
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;
      
      // Both expired or both not expired - sort by deadline
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return deadlineA - deadlineB; // Earliest deadline first
    });
  }, [allWagers]);

  const expiredWagers = useMemo(() => {
    return allWagers.filter(w => isExpired(w)).sort((a, b) => {
      // Sort expired by deadline (most recently expired first)
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : 0;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : 0;
      return deadlineB - deadlineA; // Most recently expired first
    });
  }, [allWagers]);

  const settledWagers = useMemo(() => {
    return allWagers.filter(w => w.status === "RESOLVED").sort((a, b) => {
      // Sort settled by deadline (most recently settled first)
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : 0;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : 0;
      return deadlineB - deadlineA; // Most recently settled first
    });
  }, [allWagers]);

  // Filter wagers based on active tab, search, and category
  const filteredWagers = useMemo(() => {
    let tabWagers: WagerWithEntries[];
    if (activeTab === 'system') {
      tabWagers = systemWagers;
    } else if (activeTab === 'user') {
      tabWagers = userWagers;
    } else if (activeTab === 'expired') {
      tabWagers = expiredWagers;
    } else {
      tabWagers = settledWagers;
    }
    
    // Filter by category
    if (selectedCategory) {
      tabWagers = tabWagers.filter(wager => wager.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      tabWagers = tabWagers.filter(wager => 
        wager.title.toLowerCase().includes(query) ||
        wager.description?.toLowerCase().includes(query) ||
        wager.side_a.toLowerCase().includes(query) ||
        wager.side_b.toLowerCase().includes(query) ||
        wager.category?.toLowerCase().includes(query) ||
        wager.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return tabWagers;
  }, [activeTab, systemWagers, userWagers, expiredWagers, settledWagers, searchQuery, selectedCategory]);

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: () => fetchWagers(true),
    threshold: 80,
    disabled: loading,
  });

  const fetchWagers = useCallback(async (force = false) => {
    const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
    const cacheKey = CACHE_KEYS.WAGERS;
    
    if (!force) {
      const cached = cache.get<WagerWithEntries[]>(cacheKey);
      if (cached) {
        setAllWagers(cached);
        setLoading(false);
        
        const cacheEntry = (cache as any).memoryCache.get(cacheKey);
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.WAGERS / 2;
          
          if (age > staleThreshold) {
            fetchWagers(true).catch(() => {});
          }
        }
        return;
      }
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();

    let wagersData: any[] = [];
    let error: any = null;

    if (currentUser) {
      const { data: userEntries } = await supabase
        .from("wager_entries")
        .select("wager_id")
        .eq("user_id", currentUser.id);

      const joinedWagerIds = userEntries?.map(e => e.wager_id) || [];

      const { data: publicWagers, error: publicError } = await supabase
        .from("wagers")
        .select("*, created_at")
        .eq("is_public", true)
        .order("deadline", { ascending: true })
        .limit(200);

      if (publicError) {
        error = publicError;
      } else if (publicWagers) {
        wagersData = [...publicWagers];
      }

      const { data: createdWagers, error: createdError } = await supabase
        .from("wagers")
        .select("*, created_at")
        .eq("is_public", false)
        .eq("creator_id", currentUser.id)
        .order("deadline", { ascending: true })
        .limit(100);

      if (!error && createdError) {
        error = createdError;
      } else if (createdWagers) {
        const existingIds = new Set(wagersData.map(w => w.id));
        createdWagers.forEach(w => {
          if (!existingIds.has(w.id)) {
            wagersData.push(w);
            existingIds.add(w.id);
          }
        });
      }

      if (joinedWagerIds.length > 0) {
        const { data: joinedWagers, error: joinedError } = await supabase
          .from("wagers")
          .select("*, created_at")
          .eq("is_public", false)
          .in("id", joinedWagerIds)
          .order("deadline", { ascending: true })
          .limit(100);

        if (!error && joinedError) {
          error = joinedError;
        } else if (joinedWagers) {
          const existingIds = new Set(wagersData.map(w => w.id));
          joinedWagers.forEach(w => {
            if (!existingIds.has(w.id)) {
              wagersData.push(w);
              existingIds.add(w.id);
            }
          });
        }
      }

      // Sort by deadline (earliest first, expired last)
      const isExpiredWager = (w: any) => {
        if (!w.deadline || w.status !== "OPEN") return false;
        return new Date(w.deadline).getTime() < Date.now();
      };
      
      wagersData.sort((a, b) => {
        const aExpired = isExpiredWager(a);
        const bExpired = isExpiredWager(b);
        
        // Expired wagers go to the end
        if (aExpired && !bExpired) return 1;
        if (!aExpired && bExpired) return -1;
        
        // Both expired or both not expired - sort by deadline
        const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return deadlineA - deadlineB;
      });
    } else {
      const { data: publicWagers, error: publicError } = await supabase
        .from("wagers")
        .select("*, created_at")
        .eq("is_public", true)
        .order("deadline", { ascending: true })
        .limit(200);

      if (publicError) {
        error = publicError;
      } else if (publicWagers) {
        wagersData = publicWagers;
      }
    }

    if (error) {
      console.error("Error fetching wagers:", error);
      setLoading(false);
      return;
    }

    if (wagersData) {
      const wagerIds = wagersData.map(w => w.id);
      if (wagerIds.length > 0) {
        const { data: allEntriesData } = await supabase
          .from("wager_entries")
          .select("wager_id, side, amount")
          .in("wager_id", wagerIds);

        const counts = new Map<string, number>();
        const sideACounts = new Map<string, number>();
        const sideBCounts = new Map<string, number>();
        const sideATotals = new Map<string, number>();
        const sideBTotals = new Map<string, number>();

        allEntriesData?.forEach(entry => {
          counts.set(entry.wager_id, (counts.get(entry.wager_id) || 0) + 1);
          
          if (entry.side === "a") {
            sideACounts.set(entry.wager_id, (sideACounts.get(entry.wager_id) || 0) + 1);
            sideATotals.set(entry.wager_id, (sideATotals.get(entry.wager_id) || 0) + Number(entry.amount));
          } else if (entry.side === "b") {
            sideBCounts.set(entry.wager_id, (sideBCounts.get(entry.wager_id) || 0) + 1);
            sideBTotals.set(entry.wager_id, (sideBTotals.get(entry.wager_id) || 0) + Number(entry.amount));
          }
        });

        const wagersWithCounts = wagersData.map((wager: Wager) => ({
          ...wager,
          entries_count: counts.get(wager.id) || 0,
          side_a_count: sideACounts.get(wager.id) || 0,
          side_b_count: sideBCounts.get(wager.id) || 0,
          side_a_total: sideATotals.get(wager.id) || 0,
          side_b_total: sideBTotals.get(wager.id) || 0,
        }));
        
        // Sort by deadline (earliest deadline first, expired last)
        const isExpiredWagerWithCounts = (w: WagerWithEntries) => {
          if (!w.deadline || w.status !== "OPEN") return false;
          return new Date(w.deadline).getTime() < Date.now();
        };
        
        wagersWithCounts.sort((a, b) => {
          const aExpired = isExpiredWagerWithCounts(a);
          const bExpired = isExpiredWagerWithCounts(b);
          
          // Expired wagers go to the end
          if (aExpired && !bExpired) return 1;
          if (!aExpired && bExpired) return -1;
          
          // Both expired or both not expired - sort by deadline
          const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return deadlineA - deadlineB; // Earliest deadline first
        });
        
        setAllWagers(wagersWithCounts);
        
        const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
        cache.set(CACHE_KEYS.WAGERS, wagersWithCounts, CACHE_TTL.WAGERS);
      } else {
        setAllWagers([]);
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const shouldShowLogin = searchParams.get('login') === 'true';
    if (!user && shouldShowLogin) {
      setShowAuthModal(true);
      router.replace('/wagers', { scroll: false });
    }
  }, [user, searchParams, router]);

  useEffect(() => {
    fetchWagers();

    const wagersChannel = supabase
      .channel("wagers-list")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "wagers",
          filter: "is_public=eq.true"
        },
        () => {
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.removeItem('wagers_cache');
            } catch (e) {}
          }
          fetchWagers();
        }
      )
      .subscribe();

    const entriesChannel = supabase
      .channel("wager-entries-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wager_entries" },
        () => {
          fetchWagers();
        }
      )
      .subscribe();

    return () => {
      wagersChannel.unsubscribe();
      entriesChannel.unsubscribe();
    };
  }, [fetchWagers, supabase]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    trackABTestEvent(AB_TESTS.WAGERS_PAGE_LAYOUT, layoutVariant, 'tab_switched', { tab });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    trackABTestEvent(AB_TESTS.WAGERS_PAGE_LAYOUT, layoutVariant, 'search_performed', { query_length: query.length });
  };

  // Render horizontal scrollable section
  const renderHorizontalSection = (wagersList: WagerWithEntries[], title: string, emptyMessage: string) => {
    if (loading) {
      return (
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[280px] md:w-[320px]">
              <div className="bg-card border border-border rounded-lg p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (wagersList.length === 0) {
      return (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <div className="max-w-md mx-auto">
            <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <HomeIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-2">{emptyMessage}</h3>
            <p className="text-sm text-muted-foreground">Check back later for new wagers!</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
        {wagersList.map((wager) => (
          <div key={wager.id} className="flex-shrink-0 w-[280px] md:w-[320px] snap-start">
            <WagerCard
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
              onClick={() => trackABTestEvent(AB_TESTS.WAGERS_PAGE_LAYOUT, layoutVariant, 'wager_clicked', { wager_id: wager.id, tab: activeTab })}
            />
          </div>
        ))}
      </div>
    );
  };

  // Variant B: Vertical grid layout (fallback)
  const renderVerticalGrid = () => {
    if (loading) {
      return (
        <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      );
    }

    if (filteredWagers.length === 0) {
      return (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <div className="max-w-md mx-auto">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <HomeIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No wagers found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Be the first to create a wager!"}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredWagers.map((wager) => (
            <WagerCard
              key={wager.id}
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
              onClick={() => trackABTestEvent(AB_TESTS.WAGERS_PAGE_LAYOUT, layoutVariant, 'wager_clicked', { wager_id: wager.id, tab: activeTab })}
            />
        ))}
      </div>
    );
  };

  return (
    <main className="flex-1 pb-24 md:pb-0 relative">
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
              <>
                <span className="text-sm font-medium">Pull to refresh</span>
              </>
            )}
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto p-3 md:p-6">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold mb-2">Discover Wagers</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Join exciting wagers or create your own
              </p>
            </div>
            {user && (
              <Link
                href="/create"
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 md:px-6 md:py-3 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation whitespace-nowrap shadow-lg hover:shadow-xl"
                onClick={() => trackABTestEvent(AB_TESTS.WAGERS_PAGE_LAYOUT, layoutVariant, 'create_button_clicked')}
              >
                <Plus className="h-5 w-5" />
                <span>Create Wager</span>
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-border mb-4 overflow-x-auto">
            <button
              onClick={() => handleTabChange('system')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
                activeTab === 'system'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>System Wagers</span>
              <span className="ml-1 px-2 py-0.5 text-xs bg-muted rounded-full">
                {systemWagers.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('user')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
                activeTab === 'user'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>User Wagers</span>
              <span className="ml-1 px-2 py-0.5 text-xs bg-muted rounded-full">
                {userWagers.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('expired')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
                activeTab === 'expired'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <X className="h-4 w-4" />
              <span>Expired</span>
              <span className="ml-1 px-2 py-0.5 text-xs bg-muted rounded-full">
                {expiredWagers.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('settled')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
                activeTab === 'settled'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Tag className="h-4 w-4" />
              <span>Settled</span>
              <span className="ml-1 px-2 py-0.5 text-xs bg-muted rounded-full">
                {settledWagers.length}
              </span>
            </button>
          </div>

          {/* Enhanced Search Bar */}
          <div className="relative group mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative bg-card/50 backdrop-blur-sm border border-border rounded-xl p-1 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search wagers by title, description, category, or tags..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 md:py-3 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm md:text-base placeholder:text-muted-foreground/60"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearch("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-muted rounded-lg transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 rounded-lg">
                    {filteredWagers.length} {filteredWagers.length === 1 ? 'result' : 'results'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter by Category</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                  selectedCategory === null
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All Categories
              </button>
              {WAGER_CATEGORIES.map((category) => {
                const getTabWagers = () => {
                  if (activeTab === 'system') return systemWagers;
                  if (activeTab === 'user') return userWagers;
                  if (activeTab === 'expired') return expiredWagers;
                  return settledWagers;
                };
                const categoryWagerCount = getTabWagers().filter(
                  w => w.category === category.id
                ).length;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center gap-1.5 ${
                      selectedCategory === category.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                    {categoryWagerCount > 0 && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                        selectedCategory === category.id
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-background/50 text-muted-foreground'
                      }`}>
                        {categoryWagerCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Variant A: Tabs with Horizontal Scroll */}
        {!mounted ? (
          // Show loading state during hydration to prevent mismatch
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        ) : layoutVariant === 'A' ? (
          <>
            {/* Horizontal Scrollable Sections */}
            {activeTab === 'system' ? (
              <div>
                <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  System Generated Wagers
                </h2>
                {renderHorizontalSection(
                  filteredWagers,
                  "System Wagers",
                  "No system wagers available at the moment"
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Community Wagers
                </h2>
                {renderHorizontalSection(
                  filteredWagers,
                  "User Wagers",
                  "No user-created wagers yet. Be the first to create one!"
                )}
              </div>
            )}
          </>
        ) : (
          /* Variant B: Vertical Grid */
          <>
            {renderVerticalGrid()}
          </>
        )}
      </div>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          router.refresh();
        }}
      />
    </main>
  );
}

export default function WagersPage() {
  return (
    <Suspense fallback={
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto p-3 md:p-6">
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
