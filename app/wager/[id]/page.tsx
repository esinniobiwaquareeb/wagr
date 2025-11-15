"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth-modal";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Sparkles, User } from "lucide-react";

interface Wager {
  id: string;
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  status: string;
  deadline: string;
  winning_side: string | null;
  fee_percentage: number;
  currency?: string;
  is_system_generated?: boolean;
  is_public?: boolean;
  creator_id?: string;
}

interface Entry {
  id: string;
  side: string;
  amount: number;
  user_id: string;
  created_at: string;
}

export default function WagerDetail() {
  const params = useParams();
  const wagerId = params.id as string;
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<any>(null);
  const [wager, setWager] = useState<Wager | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sideCount, setSideCount] = useState({ a: 0, b: 0 });
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);
  const { toast } = useToast();
  
  // A/B Testing
  const buttonVariant = useMemo(() => getVariant(AB_TESTS.BUTTON_STYLE), []);

  const getUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data?.user || null);
  }, [supabase]);

  useEffect(() => {
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, [getUser, supabase]);

  const fetchWager = useCallback(async () => {
    // Check cache first
    const cacheKey = `wager_${wagerId}`;
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        const CACHE_TTL = 60 * 1000; // 1 minute
        if (Date.now() - cachedData.timestamp < CACHE_TTL && cachedData.wager) {
          setWager(cachedData.wager);
          setEntries(cachedData.entries || []);
          setSideCount(cachedData.sideCount || { a: 0, b: 0 });
          setLoading(false);
        }
      } catch (e) {
        // Cache invalid, continue with fetch
      }
    }

    const { data: wagerData, error } = await supabase
      .from("wagers")
      .select("*")
      .eq("id", wagerId)
      .single();

    if (error || !wagerData) {
      setLoading(false);
      return;
    }

    // Check if wager is public or user is creator
    if (!wagerData.is_public && wagerData.creator_id !== user?.id) {
      setLoading(false);
      return;
    }

    setWager(wagerData);

    const { data: entriesData } = await supabase
      .from("wager_entries")
      .select("*")
      .eq("wager_id", wagerId);

    if (entriesData) {
      setEntries(entriesData);
      const aCounts = entriesData.filter(
        (e: Entry) => e.side === "a"
      ).length;
      const bCounts = entriesData.filter(
        (e: Entry) => e.side === "b"
      ).length;
      const sideCount = { a: aCounts, b: bCounts };
      setSideCount(sideCount);

      // Cache the results
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            wager: wagerData,
            entries: entriesData,
            sideCount,
            timestamp: Date.now(),
          }));
        } catch (e) {
          // SessionStorage might be full
        }
      }
    }
    setLoading(false);
  }, [wagerId, supabase, user]);

  useEffect(() => {
    fetchWager();

    // Subscribe to real-time updates for wager entries
    const entriesChannel = supabase
      .channel(`wager-entries:${wagerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wager_entries", filter: `wager_id=eq.${wagerId}` },
        () => {
          fetchWager();
        }
      )
      .subscribe();

    // Subscribe to real-time updates for wager status changes
    const wagerChannel = supabase
      .channel(`wager-status:${wagerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wagers", filter: `id=eq.${wagerId}` },
        () => {
          fetchWager();
        }
      )
      .subscribe();

    return () => {
      entriesChannel.unsubscribe();
      wagerChannel.unsubscribe();
    };
  }, [wagerId, fetchWager, supabase]);

  const handleJoin = async (side: "a" | "b") => {
    if (!user) {
      setSelectedSide(side);
      setShowAuthModal(true);
      return;
    }

    setJoining(true);
    try {
      // Check if user already has an entry for this wager
      const { data: existingEntry } = await supabase
        .from("wager_entries")
        .select("id")
        .eq("wager_id", wagerId)
        .eq("user_id", user.id)
        .single();

      if (existingEntry) {
        toast({
          title: "Already joined",
          description: "You have already placed a bet on this wager.",
          variant: "destructive",
        });
        setJoining(false);
        return;
      }

      // Check user balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .single();

      if (!profile || profile.balance < wager!.amount) {
        toast({
          title: "Insufficient balance",
          description: "You don't have enough balance to join this wager.",
          variant: "destructive",
        });
        setJoining(false);
        return;
      }

      // Deduct balance
      await supabase.rpc("increment_balance", {
        user_id: user.id,
        amt: -wager!.amount,
      });

      // Add entry
      const { error } = await supabase.from("wager_entries").insert({
        wager_id: wagerId,
        user_id: user.id,
        side: side,
        amount: wager!.amount,
      });

      if (error) {
        // Check if it's a duplicate entry error
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: "Already joined",
            description: "You have already placed a bet on this wager.",
            variant: "destructive",
          });
          setJoining(false);
          return;
        }
        throw error;
      }

      // Add transaction
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "wager_join",
        amount: -wager!.amount,
        reference: wagerId,
      });

      // Refresh wager data
      const { data: wagerData } = await supabase
        .from("wagers")
        .select("*")
        .eq("id", wagerId)
        .single();

      if (wagerData) {
        setWager(wagerData);

        const { data: entriesData } = await supabase
          .from("wager_entries")
          .select("*")
          .eq("wager_id", wagerId);

        if (entriesData) {
          setEntries(entriesData);
          const aCounts = entriesData.filter(
            (e: Entry) => e.side === "a"
          ).length;
          const bCounts = entriesData.filter(
            (e: Entry) => e.side === "b"
          ).length;
          setSideCount({ a: aCounts, b: bCounts });
        }
      }

      trackABTestEvent(AB_TESTS.BUTTON_STYLE, buttonVariant, 'wager_joined', {
        wager_id: wagerId,
        side: side,
      });
      
      toast({
        title: "Success!",
        description: "You've successfully joined the wager.",
      });
    } catch (error) {
      console.error("Error joining wager:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join wager. Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Loading wager...</p>
        </div>
      </main>
    );
  }

  if (!wager) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Wager not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          if (selectedSide && user) {
            handleJoin(selectedSide);
          }
        }}
      />

      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 md:gap-3 mb-3 md:mb-4">
            <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold flex-1 truncate">{wager.title}</h1>
              {wager.is_system_generated ? (
                <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="text-[9px] md:text-xs font-medium hidden sm:inline">Auto</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                  <User className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="text-[9px] md:text-xs font-medium hidden sm:inline">User</span>
                </div>
              )}
            </div>
            <span
              className={`text-[9px] md:text-xs px-2 md:px-3 py-0.5 md:py-1 rounded-full self-start sm:self-auto font-medium ${
                wager.status === "OPEN"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : wager.status === "RESOLVED"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              {wager.status}
            </span>
          </div>
          {wager.description && (
            <p className="text-xs md:text-base text-muted-foreground mb-2 md:mb-4">{wager.description}</p>
          )}

          <div className="bg-card border border-border rounded-lg p-2.5 md:p-5 mb-2 md:mb-4">
            <div className="grid grid-cols-2 gap-2 md:gap-4 mb-2 md:mb-4">
              <div>
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Entry Fee</p>
                <p className="text-base md:text-2xl font-bold">{formatCurrency(wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}</p>
              </div>
              <div>
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Platform Fee</p>
                <p className="text-base md:text-2xl font-bold">
                  {(wager.fee_percentage * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {wager.deadline && (
              <div className="text-xs md:text-sm text-muted-foreground">
                Deadline:{" "}
                {formatDistanceToNow(new Date(wager.deadline), {
                  addSuffix: true,
                })}
              </div>
            )}

            {wager.status === "RESOLVED" && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                <p className="font-semibold">
                  Winning side: <span className="text-primary">{wager.winning_side}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 mb-3 md:mb-6">
          <div className="border border-border rounded-lg p-2.5 md:p-5">
            <h3 className="font-semibold mb-1 md:mb-2 text-xs md:text-lg truncate">{wager.side_a}</h3>
            <p className="text-lg md:text-3xl font-bold text-primary mb-1 md:mb-2">
              {sideCount.a}
            </p>
            <p className="text-[9px] md:text-sm text-muted-foreground mb-1.5 md:mb-3">
              {formatCurrency(sideCount.a * wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
            </p>
            {wager.status === "OPEN" && (
              <button
                onClick={() => handleJoin("a")}
                disabled={joining}
                className={`w-full bg-primary text-primary-foreground py-1.5 md:py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation text-xs md:text-base ${
                  buttonVariant === 'B' ? 'shadow-lg hover:shadow-xl' : ''
                }`}
              >
                {joining ? "Joining..." : "Join This Side"}
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg p-2.5 md:p-5">
            <h3 className="font-semibold mb-1 md:mb-2 text-xs md:text-lg truncate">{wager.side_b}</h3>
            <p className="text-lg md:text-3xl font-bold text-primary mb-1 md:mb-2">
              {sideCount.b}
            </p>
            <p className="text-[9px] md:text-sm text-muted-foreground mb-1.5 md:mb-3">
              {formatCurrency(sideCount.b * wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
            </p>
            {wager.status === "OPEN" && (
              <button
                onClick={() => handleJoin("b")}
                disabled={joining}
                className={`w-full bg-primary text-primary-foreground py-1.5 md:py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation text-xs md:text-base ${
                  buttonVariant === 'B' ? 'shadow-lg hover:shadow-xl' : ''
                }`}
              >
                {joining ? "Joining..." : "Join This Side"}
              </button>
            )}
          </div>
        </div>

        {entries.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-2.5 md:p-5">
            <h3 className="text-xs md:text-lg font-semibold mb-2 md:mb-3">Recent Participants</h3>
            <div className="space-y-1.5 md:space-y-2 max-h-48 md:max-h-64 overflow-y-auto">
              {entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex justify-between text-[10px] md:text-sm py-0.5 md:py-1">
                  <span className="text-muted-foreground truncate flex-1 mr-2">
                    {entry.user_id.slice(0, 8)}...
                  </span>
                  <span className="text-right whitespace-nowrap text-[10px] md:text-sm">
                    {entry.side === "a" ? wager.side_a : wager.side_b} •{" "}
                    {formatCurrency(entry.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
