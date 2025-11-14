"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth-modal";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
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
  winning_side: string | null;
  fee_percentage: number;
  currency?: string;
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
    setLoading(false);
  }, [wagerId, supabase]);

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
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Loading wager...</p>
        </div>
      </main>
    );
  }

  if (!wager) {
    return (
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Wager not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-20 md:pb-0">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          if (selectedSide && user) {
            handleJoin(selectedSide);
          }
        }}
      />

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
            <h1 className="text-2xl md:text-3xl font-bold flex-1">{wager.title}</h1>
            <span
              className={`text-xs px-3 py-1 rounded-full self-start sm:self-auto ${
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
            <p className="text-sm md:text-base text-muted-foreground mb-4">{wager.description}</p>
          )}

          <div className="bg-card border border-border rounded-lg p-4 md:p-5 mb-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">Entry Fee</p>
                <p className="text-xl md:text-2xl font-bold">{formatCurrency(wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">Platform Fee</p>
                <p className="text-xl md:text-2xl font-bold">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="border border-border rounded-lg p-4 md:p-5">
            <h3 className="font-semibold mb-2 text-base md:text-lg">{wager.side_a}</h3>
            <p className="text-2xl md:text-3xl font-bold text-primary mb-2">
              {sideCount.a}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mb-3">
              {formatCurrency(sideCount.a * wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
            </p>
            {wager.status === "OPEN" && (
              <button
                onClick={() => handleJoin("a")}
                disabled={joining}
                className={`w-full bg-primary text-primary-foreground py-3 md:py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation text-sm md:text-base ${
                  buttonVariant === 'B' ? 'shadow-lg hover:shadow-xl' : ''
                }`}
              >
                {joining ? "Joining..." : "Join This Side"}
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg p-4 md:p-5">
            <h3 className="font-semibold mb-2 text-base md:text-lg">{wager.side_b}</h3>
            <p className="text-2xl md:text-3xl font-bold text-primary mb-2">
              {sideCount.b}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mb-3">
              {formatCurrency(sideCount.b * wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
            </p>
            {wager.status === "OPEN" && (
              <button
                onClick={() => handleJoin("b")}
                disabled={joining}
                className={`w-full bg-primary text-primary-foreground py-3 md:py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation text-sm md:text-base ${
                  buttonVariant === 'B' ? 'shadow-lg hover:shadow-xl' : ''
                }`}
              >
                {joining ? "Joining..." : "Join This Side"}
              </button>
            )}
          </div>
        </div>

        {entries.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 md:p-5">
            <h3 className="text-base md:text-lg font-semibold mb-3">Recent Participants</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex justify-between text-xs md:text-sm py-1">
                  <span className="text-muted-foreground truncate flex-1 mr-2">
                    {entry.user_id.slice(0, 8)}...
                  </span>
                  <span className="text-right whitespace-nowrap">
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
