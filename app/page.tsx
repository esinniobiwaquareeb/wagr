"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { WagerCard } from "@/components/wager-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Home as HomeIcon, Plus } from "lucide-react";
import Link from "next/link";

interface Wager {
  id: string;
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  status: string;
  deadline: string;
  currency?: string;
  category?: string;
  tags?: string[];
  is_system_generated?: boolean;
  is_public?: boolean;
}

interface WagerWithEntries extends Wager {
  entries_count: number;
}

export default function Home() {
  const [wagers, setWagers] = useState<WagerWithEntries[]>([]);
  const [allWagers, setAllWagers] = useState<WagerWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const supabase = useMemo(() => createClient(), []);
  
  // Cache entry counts to avoid N+1 queries
  const entryCountsCache = useMemo(() => new Map<string, number>(), []);
  
  // A/B Testing
  const layoutVariant = useMemo(() => getVariant(AB_TESTS.HOME_LAYOUT), []);

  const fetchWagers = useCallback(async () => {
    // Check cache first
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem('wagers_cache') : null;
    if (cached) {
      try {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        const CACHE_TTL = 30 * 1000; // 30 seconds
        if (Date.now() - timestamp < CACHE_TTL && cachedData) {
          setAllWagers(cachedData);
          setLoading(false);
          // Still fetch in background to update
        }
      } catch (e) {
        // Cache invalid, continue with fetch
      }
    }

    const { data: wagersData, error } = await supabase
      .from("wagers")
      .select("*")
      .eq("is_public", true) // Only fetch public wagers
      .order("created_at", { ascending: false })
      .limit(100); // Limit to prevent large queries

    if (error) {
      console.error("Error fetching wagers:", error);
      setLoading(false);
      return;
    }

    if (wagersData) {
      // Fetch all entry counts in a single optimized query
      const wagerIds = wagersData.map(w => w.id);
      if (wagerIds.length > 0) {
        const { data: entriesData } = await supabase
          .from("wager_entries")
          .select("wager_id")
          .in("wager_id", wagerIds);

        // Count entries per wager
        const counts = new Map<string, number>();
        entriesData?.forEach(entry => {
          counts.set(entry.wager_id, (counts.get(entry.wager_id) || 0) + 1);
        });

        const wagersWithCounts = wagersData.map((wager: Wager) => ({
          ...wager,
          entries_count: counts.get(wager.id) || 0,
        }));
        
        setAllWagers(wagersWithCounts);
        
        // Cache the results
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('wagers_cache', JSON.stringify({
              data: wagersWithCounts,
              timestamp: Date.now(),
            }));
          } catch (e) {
            // SessionStorage might be full
          }
        }
        
        // Update cache
        counts.forEach((count, id) => entryCountsCache.set(id, count));
      } else {
        setAllWagers([]);
      }
    }
    setLoading(false);
  }, [supabase, entryCountsCache]);

  // Fetch user preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_preferences")
        .select("preferred_categories")
        .eq("user_id", user.id)
        .single();

      if (data?.preferred_categories) {
        setUserPreferences(data.preferred_categories);
      }
    };

    fetchPreferences();
  }, [supabase]);

  const [tagPreferences, setTagPreferences] = useState<string[]>([]);

  // Fetch user tag preferences
  useEffect(() => {
    const fetchTagPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTagPreferences([]);
        return;
      }

      const { data } = await supabase
        .from("user_preferences")
        .select("preferred_tags")
        .eq("user_id", user.id)
        .single();

      if (data?.preferred_tags) {
        setTagPreferences(data.preferred_tags);
      } else {
        setTagPreferences([]);
      }
    };

    fetchTagPreferences();
  }, [supabase]);

  // Filter wagers based on category, preferences, and tags
  useEffect(() => {
    let filtered = [...allWagers];

    // Filter by selected category (explicit selection takes priority)
    if (selectedCategory) {
      filtered = filtered.filter(w => w.category === selectedCategory);
    }
    // Note: User preferences are not used as filters - they're just for sorting/display
    // All public wagers should be visible unless a category is explicitly selected

    // Filter by tags if user has tag preferences
    // Only filter if wager has tags - wagers without tags should always show
    if (tagPreferences.length > 0) {
      filtered = filtered.filter(w => {
        // If wager has no tags, always show it
        if (!w.tags || w.tags.length === 0) return true;
        // If wager has tags, only show if at least one tag matches preferences
        return w.tags.some(tag => tagPreferences.includes(tag));
      });
    }

    setWagers(filtered);
  }, [allWagers, selectedCategory, userPreferences, tagPreferences]);

  useEffect(() => {
    fetchWagers();

    // Subscribe to real-time updates for wagers
    const wagersChannel = supabase
      .channel("wagers-list")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "wagers",
          filter: "is_public=eq.true" // Only listen to public wagers
        },
        (payload) => {
          // Clear cache when wagers change to ensure fresh data
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.removeItem('wagers_cache');
            } catch (e) {
              // Ignore
            }
          }
          fetchWagers();
        }
      )
      .subscribe();

    // Subscribe to real-time updates for wager entries (to update counts)
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

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
            <div>
              <h1 className="text-xl md:text-4xl font-bold mb-1 md:mb-2">Wagers</h1>
              <p className="text-xs md:text-base text-muted-foreground">
                Join and create wagers. Pick a side and win!
              </p>
            </div>
            <Link
              href="/create"
              className="hidden md:flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 md:px-6 md:py-3 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation whitespace-nowrap"
            >
              <Plus className="h-5 w-5" />
              <span>Create Wager</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        ) : wagers.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <div className="max-w-md mx-auto">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <HomeIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No wagers available</h3>
              <p className="text-sm text-muted-foreground mb-4">Be the first to create a wager!</p>
            </div>
          </div>
        ) : (
          <div 
            className={`grid gap-3 md:gap-4 ${
              layoutVariant === 'A' 
                ? 'sm:grid-cols-2 lg:grid-cols-3' 
                : 'sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {wagers.map((wager) => (
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
                isSystemGenerated={wager.is_system_generated || false}
                onClick={() => trackABTestEvent(AB_TESTS.HOME_LAYOUT, layoutVariant, 'wager_clicked', { wager_id: wager.id })}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
