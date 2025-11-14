"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { WagerCard } from "@/components/wager-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";

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
    const { data: wagersData } = await supabase
      .from("wagers")
      .select("*")
      .order("created_at", { ascending: false });

    if (wagersData) {
      // Fetch all entry counts in a single optimized query
      const wagerIds = wagersData.map(w => w.id);
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
      // Update cache
      counts.forEach((count, id) => entryCountsCache.set(id, count));
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

    // Filter by selected category
    if (selectedCategory) {
      filtered = filtered.filter(w => w.category === selectedCategory);
    } else if (userPreferences.length > 0) {
      // Filter by user preferences if no category selected
      filtered = filtered.filter(w => 
        !w.category || userPreferences.includes(w.category)
      );
    }

    // Filter by tags if user has tag preferences
    if (tagPreferences.length > 0) {
      filtered = filtered.filter(w => {
        if (!w.tags || w.tags.length === 0) return true;
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
        { event: "*", schema: "public", table: "wagers" },
        () => {
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
    <main className="flex-1 pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Wagers</h1>
          <p className="text-muted-foreground">
            Join and create wagers. Pick a side and win!
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="text-center py-12">
            <p className="text-muted-foreground">No wagers available yet</p>
          </div>
        ) : (
          <div 
            className={`grid gap-4 ${
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
                onClick={() => trackABTestEvent(AB_TESTS.HOME_LAYOUT, layoutVariant, 'wager_clicked', { wager_id: wager.id })}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
