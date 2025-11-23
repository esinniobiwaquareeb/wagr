"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { WagerCard } from "@/components/wager-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Home as HomeIcon, Loader2, Sparkles, User, Clock, CheckCircle } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { CreateWagerModal } from "@/components/create-wager-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";
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
  tags?: string[];
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

type TabType = 'all' | 'system' | 'user' | 'expired' | 'settled';

function WagersPageContent() {
  const [allWagers, setAllWagers] = useState<WagerWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userEntries, setUserEntries] = useState<Map<string, { amount: number; side: string }>>(new Map());
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Get tab and category from URL params
  const activeTab = (searchParams?.get('tab') as TabType) || 'all';
  const selectedCategory = searchParams?.get('category') || null;
  const searchQuery = searchParams?.get('search') || '';

  // Helper function to check if wager is expired
  const isExpired = (wager: WagerWithEntries) => {
    if (!wager.deadline || wager.status !== "OPEN") return false;
    return new Date(wager.deadline).getTime() < Date.now();
  };

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
  }, [allWagers]);

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
  }, [allWagers]);

  const expiredWagers = useMemo(() => {
    return allWagers.filter(w => isExpired(w)).sort((a, b) => {
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : 0;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : 0;
      return deadlineB - deadlineA;
    });
  }, [allWagers]);

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

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWagers = useCallback(async (force = false) => {
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;

    let userEntriesMap = new Map<string, { amount: number; side: string }>();
    if (user) {
      const { data: userEntriesData } = await supabase
        .from("wager_entries")
        .select("wager_id, amount, side")
        .eq("user_id", user.id);

      userEntriesData?.forEach(entry => {
        const existing = userEntriesMap.get(entry.wager_id);
        if (existing) {
          userEntriesMap.set(entry.wager_id, {
            amount: existing.amount + Number(entry.amount),
            side: existing.side,
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
      const response = await wagersApi.list({ limit: 200 });
      const wagersData = response?.wagers || (Array.isArray(response) ? response : []);

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
  }, [supabase, user, toast]);

  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchWagers(true);
    }, 1000);
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
          debouncedRefetchRef.current();
        }
      )
      .subscribe();

    const entriesChannel = supabase
      .channel("wager-entries-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wager_entries" },
        () => {
          debouncedRefetchRef.current();
        }
      )
      .subscribe();

    // Listen for wager update events from card components
    const handleWagerUpdate = () => {
      debouncedRefetchRef.current();
    };
    window.addEventListener('wager-updated', handleWagerUpdate);

    return () => {
      wagersChannel.unsubscribe();
      entriesChannel.unsubscribe();
      window.removeEventListener('wager-updated', handleWagerUpdate);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [supabase, fetchWagers]); // Keep fetchWagers but use ref for callbacks

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

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Tabs - Grid on Mobile, Horizontal on Desktop */}
        <div className="mb-4">
          {/* Mobile: Grid Layout with Icons */}
          <div className="lg:hidden grid grid-cols-4 gap-2">
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
              <span className="text-xs font-medium">User</span>
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
              <span className="text-xs font-medium">Expired</span>
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

          {/* Desktop: Horizontal Layout */}
          <div className="hidden lg:flex gap-2">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleTabChange('system')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                activeTab === 'system'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              System ({systemWagers.length})
            </button>
            <button
              onClick={() => handleTabChange('user')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                activeTab === 'user'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              User ({userWagers.length})
            </button>
            <button
              onClick={() => handleTabChange('expired')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                activeTab === 'expired'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              Expired ({expiredWagers.length})
            </button>
            <button
              onClick={() => handleTabChange('settled')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                activeTab === 'settled'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              Settled ({settledWagers.length})
            </button>
          </div>
        </div>

        {/* Wager Grid */}
        {loading ? (
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
        ) : filteredWagers.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <div className="max-w-md mx-auto">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <HomeIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No wagers found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Be the first to create a wager!"}
            </p>
              {user && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:opacity-90 transition-all active:scale-95 touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
                >
                  Create Wager
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          router.refresh();
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
