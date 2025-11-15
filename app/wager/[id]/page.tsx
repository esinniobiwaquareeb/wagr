"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth-modal";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Sparkles, User, Users, Clock, Trophy, TrendingUp, Award } from "lucide-react";

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

  const totalParticipants = sideCount.a + sideCount.b;
  const sideAPercentage = totalParticipants > 0 ? (sideCount.a / totalParticipants) * 100 : 50;
  const sideBPercentage = totalParticipants > 0 ? (sideCount.b / totalParticipants) * 100 : 50;
  const totalPot = (sideCount.a + sideCount.b) * wager.amount;
  const sideAPot = sideCount.a * wager.amount;
  const sideBPot = sideCount.b * wager.amount;

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

      <div className="max-w-7xl mx-auto p-3 md:p-6">
        {/* Header Section */}
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3 mb-3 md:mb-4">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <h1 className="text-xl md:text-4xl font-bold flex-1 truncate">{wager.title}</h1>
              {wager.is_system_generated ? (
                <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="text-[10px] md:text-xs font-medium hidden sm:inline">Auto</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                  <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="text-[10px] md:text-xs font-medium hidden sm:inline">User</span>
                </div>
              )}
              <span
                className={`text-[10px] md:text-xs px-2.5 md:px-3 py-1 md:py-1.5 rounded-full font-semibold flex-shrink-0 ${
                  wager.status === "OPEN"
                    ? "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30"
                    : wager.status === "RESOLVED"
                      ? "bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                      : "bg-gray-500/20 text-gray-700 dark:text-gray-400 border border-gray-500/30"
                }`}
              >
                {wager.status}
              </span>
            </div>
          </div>
          
          {wager.description && (
            <p className="text-sm md:text-lg text-muted-foreground mb-4 md:mb-6 leading-relaxed">{wager.description}</p>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Participants</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">{totalParticipants}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Total Pot</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">{formatCurrency(totalPot, (wager.currency || DEFAULT_CURRENCY) as Currency)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Entry Fee</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">{formatCurrency(wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}</p>
            </div>
            {wager.deadline && (
              <div className="bg-card border border-border rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <p className="text-[10px] md:text-xs text-muted-foreground">Deadline</p>
                </div>
                <p className="text-xs md:text-sm font-bold line-clamp-2">
                  {formatDistanceToNow(new Date(wager.deadline), { addSuffix: true })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Competition Arena - VS Layout */}
        <div className="mb-4 md:mb-6">
          <div className="bg-gradient-to-br from-card via-card to-card/50 border-2 border-border rounded-xl p-4 md:p-6 shadow-lg">
            {/* VS Header */}
            <div className="text-center mb-4 md:mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
                <Trophy className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="text-xs md:text-sm font-bold text-primary">COMPETITION</span>
              </div>
            </div>

            {/* Progress Bar */}
            {totalParticipants > 0 && (
              <div className="mb-4 md:mb-6">
                <div className="flex h-3 md:h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="bg-primary transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${sideAPercentage}%` }}
                  >
                    {sideAPercentage > 15 && (
                      <span className="text-[8px] md:text-[10px] font-bold text-primary-foreground whitespace-nowrap">
                        {Math.round(sideAPercentage)}%
                      </span>
                    )}
                  </div>
                  <div
                    className="bg-primary/60 transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${sideBPercentage}%` }}
                  >
                    {sideBPercentage > 15 && (
                      <span className="text-[8px] md:text-[10px] font-bold text-primary-foreground whitespace-nowrap">
                        {Math.round(sideBPercentage)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Competition Sides */}
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* VS Divider - Desktop */}
              <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <div className="bg-background border-4 border-border rounded-full p-3 md:p-4 shadow-lg">
                  <span className="text-2xl md:text-4xl font-black text-muted-foreground">VS</span>
                </div>
              </div>

              {/* Side A */}
              <div className={`relative border-2 rounded-xl p-4 md:p-6 transition-all ${
                sideCount.a > sideCount.b 
                  ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10" 
                  : "border-border bg-card"
              }`}>
                {sideCount.a > sideCount.b && wager.status === "OPEN" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-[10px] md:text-xs font-bold rounded-full z-20">
                    LEADING
                  </div>
                )}
                {wager.status === "RESOLVED" && wager.winning_side === "a" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-[10px] md:text-xs font-bold rounded-full flex items-center gap-1 z-20">
                    <Trophy className="h-3 w-3" />
                    WINNER
                  </div>
                )}
                
                <div className="text-center mb-4">
                  <h3 className="text-base md:text-2xl font-bold mb-2 md:mb-3">{wager.side_a}</h3>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    <p className="text-2xl md:text-4xl font-bold text-primary">{sideCount.a}</p>
                    <span className="text-sm md:text-base text-muted-foreground">bettors</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {formatCurrency(sideAPot, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
                  </p>
                </div>

                {wager.status === "OPEN" && (
                  <button
                    onClick={() => handleJoin("a")}
                    disabled={joining}
                    className={`w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl ${
                      buttonVariant === 'B' ? 'shadow-lg hover:shadow-xl' : ''
                    }`}
                  >
                    {joining ? "Joining..." : `Join ${wager.side_a}`}
                  </button>
                )}
              </div>

              {/* Mobile VS Divider */}
              <div className="md:hidden flex items-center justify-center -my-2">
                <div className="bg-background border-2 border-border rounded-full px-4 py-2 z-10">
                  <span className="text-xl font-black text-muted-foreground">VS</span>
                </div>
              </div>

              {/* Side B */}
              <div className={`relative border-2 rounded-xl p-4 md:p-6 transition-all ${
                sideCount.b > sideCount.a 
                  ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10" 
                  : "border-border bg-card"
              }`}>
                {sideCount.b > sideCount.a && wager.status === "OPEN" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-[10px] md:text-xs font-bold rounded-full z-20">
                    LEADING
                  </div>
                )}
                {wager.status === "RESOLVED" && wager.winning_side === "b" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-[10px] md:text-xs font-bold rounded-full flex items-center gap-1 z-20">
                    <Trophy className="h-3 w-3" />
                    WINNER
                  </div>
                )}
                
                <div className="text-center mb-4">
                  <h3 className="text-base md:text-2xl font-bold mb-2 md:mb-3">{wager.side_b}</h3>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    <p className="text-2xl md:text-4xl font-bold text-primary">{sideCount.b}</p>
                    <span className="text-sm md:text-base text-muted-foreground">bettors</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {formatCurrency(sideBPot, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
                  </p>
                </div>

                {wager.status === "OPEN" && (
                  <button
                    onClick={() => handleJoin("b")}
                    disabled={joining}
                    className={`w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl ${
                      buttonVariant === 'B' ? 'shadow-lg hover:shadow-xl' : ''
                    }`}
                  >
                    {joining ? "Joining..." : `Join ${wager.side_b}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resolved Status */}
        {wager.status === "RESOLVED" && wager.winning_side && (
          <div className="mb-4 md:mb-6 bg-gradient-to-r from-green-500/20 to-blue-500/20 border-2 border-green-500/30 rounded-xl p-4 md:p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
              <p className="text-base md:text-xl font-bold">
                Winner: <span className="text-primary">{wager.winning_side === "a" ? wager.side_a : wager.side_b}</span>
              </p>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              This competition has been resolved
            </p>
          </div>
        )}

        {/* Participants List */}
        {entries.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <h3 className="text-base md:text-xl font-bold">Participants ({totalParticipants})</h3>
            </div>
            <div className="space-y-2 md:space-y-3 max-h-64 md:max-h-80 overflow-y-auto">
              {entries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-center justify-between p-2.5 md:p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition"
                >
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full flex-shrink-0 ${
                      entry.side === "a" ? "bg-primary" : "bg-primary/60"
                    }`} />
                    <span className="text-xs md:text-sm font-medium text-foreground truncate">
                      {entry.user_id.slice(0, 8)}...
                    </span>
                    <span className="text-[10px] md:text-xs text-muted-foreground">
                      {entry.side === "a" ? wager.side_a : wager.side_b}
                    </span>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">
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
