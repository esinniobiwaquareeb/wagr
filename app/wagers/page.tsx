"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { WagerCard } from "@/components/wager-card";
import { WagerRow } from "@/components/wager-row";
import { Skeleton } from "@/components/ui/skeleton";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Home as HomeIcon, Plus, Search, Sparkles, Users, X, Tag, Filter, Loader2, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { AuthModal } from "@/components/auth-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_FEE_PERCENTAGE, WAGER_CATEGORIES } from "@/lib/constants";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { wagersApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

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
  tags?: string[]; // Kept for backward compatibility
  is_system_generated?: boolean;
  is_public?: boolean;
  fee_percentage?: number;
  winning_side?: string | null;
  short_id?: string | null;
}

interface WagerWithEntries extends Wager {
  entries_count: number;
  side_a_count?: number;
  side_b_count?: number;
  side_a_total?: number;
  side_b_total?: number;
  winning_side?: string | null;
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
  const [userEntries, setUserEntries] = useState<Map<string, { amount: number; side: string }>>(new Map());
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient(); // Create Supabase client for real-time subscriptions
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // View mode: 'card' or 'row'
  const [viewMode, setViewMode] = useState<'card' | 'row'>('card');
  
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

  // Separate wagers by type and sort by deadline (earliest first)
  // Filter out expired and resolved wagers since they have their own tabs
  const systemWagers = useMemo(() => {
    const filtered = allWagers.filter(w => 
      w.is_system_generated === true && 
      w.status === "OPEN" && 
      !isExpired(w)
    );
    return filtered.sort((a, b) => {
      // Sort by deadline (earliest first)
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return deadlineA - deadlineB; // Earliest deadline first
    });
  }, [allWagers]);

  const userWagers = useMemo(() => {
    const filtered = allWagers.filter(w => 
      w.is_system_generated !== true && 
      w.status === "OPEN" && 
      !isExpired(w)
    );
    return filtered.sort((a, b) => {
      // Sort by deadline (earliest first)
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
    return allWagers.filter(w => w.status === "SETTLED" || w.status === "RESOLVED").sort((a, b) => {
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
    // Always fetch user entries if user is logged in (user-specific data)
    let userEntriesMap = new Map<string, { amount: number; side: string }>();
    if (user) {
      const { data: userEntriesData } = await supabase
        .from("wager_entries")
        .select("wager_id, amount, side")
        .eq("user_id", user.id);

      // Store user entries in a map for quick lookup
      userEntriesData?.forEach(entry => {
        const existing = userEntriesMap.get(entry.wager_id);
        if (existing) {
          // Sum amounts if user has multiple entries (shouldn't happen, but handle it)
          userEntriesMap.set(entry.wager_id, {
            amount: existing.amount + Number(entry.amount),
            side: existing.side, // Keep the first side (all entries should be same side)
          });
        } else {
          userEntriesMap.set(entry.wager_id, {
            amount: Number(entry.amount),
            side: entry.side,
          });
        }
      });
      setUserEntries(userEntriesMap);
    }

    try {
      setLoading(true);
      // Fetch wagers from API (always fresh, no cache)
      const response = await wagersApi.list({ limit: 200 });
      
      // Handle both response formats for backward compatibility
      // API returns { wagers: [...], meta: {...} }
      const wagersData = response?.wagers || (Array.isArray(response) ? response : []);

      // Transform API response to match component expectations
      const wagersWithCounts: WagerWithEntries[] = wagersData.map((wager: any) => {
        const entryCounts = wager.entryCounts || { sideA: 0, sideB: 0, total: 0 };
        return {
          ...wager,
          entries_count: entryCounts.total > 0 ? Math.ceil(entryCounts.total / wager.amount) : 0,
          side_a_count: Math.ceil(entryCounts.sideA / wager.amount),
          side_b_count: Math.ceil(entryCounts.sideB / wager.amount),
          side_a_total: entryCounts.sideA,
          side_b_total: entryCounts.sideB,
        };
      });
      
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
    } catch (error) {
      console.error("Error fetching wagers:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("Full error details:", error);
      toast({
        title: "Error",
        description: `Failed to load wagers: ${errorMessage}`,
        variant: "destructive",
      });
      // Set empty array on error to prevent infinite loading state
      setAllWagers([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, user, toast]);

  useEffect(() => {
    const shouldShowLogin = searchParams.get('login') === 'true' && !user;
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
          fetchWagers(true);
        }
      )
      .subscribe();

    const entriesChannel = supabase
      .channel("wager-entries-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wager_entries" },
        () => {
          fetchWagers(true);
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
              winningSide={wager.winning_side}
              shortId={wager.short_id}
              userEntryAmount={userEntries.get(wager.id)?.amount}
              userEntrySide={userEntries.get(wager.id)?.side}
              onClick={() => trackABTestEvent(AB_TESTS.WAGERS_PAGE_LAYOUT, layoutVariant, 'wager_clicked', { wager_id: wager.id, tab: activeTab })}
            />
          </div>
        ))}
      </div>
    );
  };

  // Render row view
  const renderRowView = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-32" />
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
      <div className="space-y-2 md:space-y-3">
        {filteredWagers.map((wager) => (
          <WagerRow
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
            winningSide={wager.winning_side}
            shortId={wager.short_id}
            userEntryAmount={userEntries.get(wager.id)?.amount}
            userEntrySide={userEntries.get(wager.id)?.side}
            onClick={() => trackABTestEvent(AB_TESTS.WAGERS_PAGE_LAYOUT, layoutVariant, 'wager_clicked', { wager_id: wager.id, tab: activeTab })}
          />
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
              winningSide={wager.winning_side}
              shortId={wager.short_id}
              userEntryAmount={userEntries.get(wager.id)?.amount}
              userEntrySide={userEntries.get(wager.id)?.side}
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
          {/* Mobile Tabs - Grid Layout */}
          <div className="md:hidden grid grid-cols-4 gap-1 mb-4 border-b border-border pb-1">
            <button
              onClick={() => handleTabChange('system')}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all relative ${
                activeTab === 'system'
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Sparkles className={`h-4 w-4 transition-transform ${activeTab === 'system' ? 'scale-110' : ''}`} />
              <span className="text-[9px] font-medium leading-tight text-center">System</span>
              <span className={`text-[8px] px-1 py-0.5 rounded-full ${
                activeTab === 'system'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {systemWagers.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('user')}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all relative ${
                activeTab === 'user'
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Users className={`h-4 w-4 transition-transform ${activeTab === 'user' ? 'scale-110' : ''}`} />
              <span className="text-[9px] font-medium leading-tight text-center">User</span>
              <span className={`text-[8px] px-1 py-0.5 rounded-full ${
                activeTab === 'user'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {userWagers.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('expired')}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all relative ${
                activeTab === 'expired'
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <X className={`h-4 w-4 transition-transform ${activeTab === 'expired' ? 'scale-110' : ''}`} />
              <span className="text-[9px] font-medium leading-tight text-center">Expired</span>
              <span className={`text-[8px] px-1 py-0.5 rounded-full ${
                activeTab === 'expired'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {expiredWagers.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('settled')}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all relative ${
                activeTab === 'settled'
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Tag className={`h-4 w-4 transition-transform ${activeTab === 'settled' ? 'scale-110' : ''}`} />
              <span className="text-[9px] font-medium leading-tight text-center">Settled</span>
              <span className={`text-[8px] px-1 py-0.5 rounded-full ${
                activeTab === 'settled'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {settledWagers.length}
              </span>
            </button>
          </div>

          {/* Desktop Tabs - Horizontal Layout */}
          <div className="hidden md:flex gap-2 border-b border-border mb-4">
            <button
              onClick={() => handleTabChange('system')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap flex-shrink-0 ${
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
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap flex-shrink-0 ${
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
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap flex-shrink-0 ${
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
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap flex-shrink-0 ${
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

          {/* Enhanced Search Bar with View Toggle */}
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
                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'card'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label="Card view"
                    title="Card view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('row')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'row'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label="Row view"
                    title="Row view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
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

        {/* Render based on view mode */}
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
        ) : viewMode === 'row' ? (
          /* Row View */
          renderRowView()
        ) : viewMode === 'card' && layoutVariant === 'A' ? (
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
