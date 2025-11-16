"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth-modal";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Sparkles, User, Users, Clock, Trophy, TrendingUp, Award, Coins, Trash2 } from "lucide-react";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<any>(null);
  const [wager, setWager] = useState<Wager | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sideCount, setSideCount] = useState({ a: 0, b: 0 });
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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

  const fetchWager = useCallback(async (force = false) => {
    // Check cache first using centralized cache utility
    const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
    const cacheKey = CACHE_KEYS.WAGER(wagerId);
    
    if (!force) {
      const cached = cache.get<{ wager: Wager; entries: Entry[]; sideCount: { a: number; b: number } }>(cacheKey);
      
      if (cached) {
        setWager(cached.wager);
        setEntries(cached.entries || []);
        setSideCount(cached.sideCount || { a: 0, b: 0 });
        setLoading(false);
        
        // Check if wager expired with single participant and auto-refund
        if (cached.wager.deadline && new Date(cached.wager.deadline) <= new Date() && cached.wager.status === "OPEN") {
          const uniqueParticipants = new Set((cached.entries || []).map((e: Entry) => e.user_id));
          if (uniqueParticipants.size === 1) {
            // Trigger auto-refund in background (don't block UI)
            (async () => {
              try {
                await supabase.rpc("check_and_refund_single_participants");
                // Refresh after refund
                setTimeout(() => fetchWager(true), 1000);
              } catch (error) {
                console.error("Error auto-refunding:", error);
              }
            })();
          }
        }
        
        // Check if cache is stale - if so, refresh in background
        const cacheEntry = (cache as any).memoryCache.get(cacheKey);
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.WAGER / 2; // Consider stale after half TTL
          
          if (age > staleThreshold) {
            // Cache is getting stale, refresh in background (don't block UI)
            fetchWager(true).catch(() => {
              // Ignore errors in background refresh
            });
          }
        }
        return; // Don't fetch if we have fresh cache
      }
    }

    // No cache or forced refresh - fetch from API
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
      
      // Calculate actual amounts bet on each side (for accurate return calculations)
      const sideATotal = entriesData
        .filter((e: Entry) => e.side === "a")
        .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
      const sideBTotal = entriesData
        .filter((e: Entry) => e.side === "b")
        .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
      
      // Store totals for calculations
      (wagerData as any).sideATotal = sideATotal;
      (wagerData as any).sideBTotal = sideBTotal;

        // Cache the results using centralized cache utility
        const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
        cache.set(cacheKey, {
          wager: wagerData,
          entries: entriesData || [],
          sideCount,
        }, CACHE_TTL.WAGER);
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
      // Check if wager is still open
      if (wager!.status !== "OPEN") {
        toast({
          title: "This wager is closed",
          description: "Bets are no longer being accepted for this wager.",
          variant: "destructive",
        });
        setJoining(false);
        return;
      }

      // Check if deadline has passed
      if (wager!.deadline && new Date(wager!.deadline) <= new Date()) {
        toast({
          title: "Too late to bet",
          description: "The deadline for this wager has already passed.",
          variant: "destructive",
        });
        setJoining(false);
        return;
      }

      // Check if user already has an entry for this wager
      const { data: existingEntry } = await supabase
        .from("wager_entries")
        .select("id")
        .eq("wager_id", wagerId)
        .eq("user_id", user.id)
        .single();

      if (existingEntry) {
        toast({
          title: "You've already bet on this",
          description: "You can only place one bet per wager.",
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
          title: "Not enough funds",
          description: "You need more money in your wallet to place this bet.",
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

      // Add transaction with description
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "wager_join",
        amount: -wager!.amount,
        reference: wagerId,
        description: `Wager Entry: "${wager!.title}" - Joined ${side === "a" ? wager!.side_a : wager!.side_b}`,
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
      const errorMessage = error instanceof Error 
        ? (error.message || "An unexpected error occurred")
        : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message) || "An unexpected error occurred"
        : "Failed to join wager. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !wager) return;

    // Check if user is the creator
    if (wager.creator_id !== user.id) {
      toast({
        title: "Unauthorized",
        description: "Only the creator can delete this wager.",
        variant: "destructive",
      });
      return;
    }

    // Check if wager is still open
    if (wager.status !== "OPEN") {
      toast({
        title: "Cannot delete",
        description: "Only open wagers can be deleted.",
        variant: "destructive",
      });
      return;
    }

    // Check if there are entries from other users
    const otherUserEntries = entries.filter(entry => entry.user_id !== user.id);
    if (otherUserEntries.length > 0) {
      toast({
        title: "Cannot delete",
        description: "This wager cannot be deleted because other users have placed bets on it.",
        variant: "destructive",
      });
      return;
    }

    // Show delete confirmation dialog
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!user || !wager) return;

    setDeleting(true);

    try {
      // Check if creator has an entry and refund them
      const creatorEntry = entries.find(entry => entry.user_id === user.id);
      if (creatorEntry) {
        // Refund creator's entry
        await supabase.rpc("increment_balance", {
          user_id: user.id,
          amt: creatorEntry.amount,
        });

        // Record transaction
        await supabase.from("transactions").insert({
          user_id: user.id,
          type: "wager_refund",
          amount: creatorEntry.amount,
          reference: wagerId,
          description: `Wager Deleted: "${wager.title}" - Creator deleted wager, entry refunded`,
        });
      }

      // Delete the wager (cascade will delete all entries)
      const { error } = await supabase
        .from("wagers")
        .delete()
        .eq("id", wagerId)
        .eq("creator_id", user.id);

      if (error) throw error;

      toast({
        title: "Wager deleted",
        description: "Your wager has been deleted successfully.",
      });

      // Redirect to home page
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error deleting wager:", error);
      const errorMessage = error instanceof Error 
        ? (error.message || "An unexpected error occurred")
        : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message) || "An unexpected error occurred"
        : "Failed to delete wager. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
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
  
  // Calculate actual amounts bet on each side
  const sideATotal = entries
    .filter((e: Entry) => e.side === "a")
    .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
  const sideBTotal = entries
    .filter((e: Entry) => e.side === "b")
    .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
  
  const totalPot = sideATotal + sideBTotal;
  const sideAPot = sideATotal;
  const sideBPot = sideBTotal;

  // Calculate potential returns using actual amounts
  const returns = calculatePotentialReturns({
    entryAmount: wager.amount,
    sideATotal: sideATotal,
    sideBTotal: sideBTotal,
    feePercentage: wager.fee_percentage || 0.01,
  });

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

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Wager"
        description="Are you sure you want to delete this wager? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <div className="max-w-7xl mx-auto p-3 md:p-6">
        {/* Header Section */}
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3 mb-3 md:mb-4">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <h1 className="text-xl md:text-4xl font-bold flex-1 truncate">{wager.title}</h1>
              {/* Delete Button - Only show for creator when no other users have bet */}
              {user && wager.creator_id === user.id && wager.status === "OPEN" && entries.filter(e => e.user_id !== user.id).length === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition active:scale-[0.98] touch-manipulation disabled:opacity-50 flex-shrink-0"
                  title="Delete wager"
                >
                  <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="text-[10px] md:text-xs font-medium hidden sm:inline">Delete</span>
                </button>
              )}
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
            {wager.deadline ? (
              <div className="bg-card border border-border rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <p className="text-[10px] md:text-xs text-muted-foreground">Deadline</p>
                </div>
                <p className="text-xs md:text-sm font-bold line-clamp-2">
                  {formatDistanceToNow(new Date(wager.deadline), { addSuffix: true })}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <p className="text-[10px] md:text-xs text-muted-foreground">Platform Fee</p>
                </div>
                <p className="text-lg md:text-2xl font-bold">{(wager.fee_percentage || 0.01) * 100}%</p>
                <p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5">
                  {formatCurrency(returns.platformFee, (wager.currency || DEFAULT_CURRENCY) as Currency)}
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
                  <p className="text-xs md:text-sm text-muted-foreground mb-2">
                    {formatCurrency(sideAPot, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
                  </p>
                  {/* Potential Return for Side A */}
                  {wager.status === "OPEN" && sideCount.a > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 md:p-2.5 mb-2">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Coins className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                        <span className="text-[9px] md:text-[10px] text-muted-foreground">Potential Return</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-primary text-sm md:text-base">
                          {formatReturnMultiplier(returns.sideAReturnMultiplier)}
                        </span>
                        <span className="text-[9px] md:text-[10px] text-green-600 dark:text-green-400 font-medium">
                          {formatReturnPercentage(returns.sideAReturnPercentage)}
                        </span>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-muted-foreground mt-1">
                        Win: {formatCurrency(returns.sideAPotential, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                      </p>
                    </div>
                  )}
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
                  <p className="text-xs md:text-sm text-muted-foreground mb-2">
                    {formatCurrency(sideBPot, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
                  </p>
                  {/* Potential Return for Side B */}
                  {wager.status === "OPEN" && sideCount.b > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 md:p-2.5 mb-2">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Coins className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                        <span className="text-[9px] md:text-[10px] text-muted-foreground">Potential Return</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-primary text-sm md:text-base">
                          {formatReturnMultiplier(returns.sideBReturnMultiplier)}
                        </span>
                        <span className="text-[9px] md:text-[10px] text-green-600 dark:text-green-400 font-medium">
                          {formatReturnPercentage(returns.sideBReturnPercentage)}
                        </span>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-muted-foreground mt-1">
                        Win: {formatCurrency(returns.sideBPotential, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                      </p>
                    </div>
                  )}
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
