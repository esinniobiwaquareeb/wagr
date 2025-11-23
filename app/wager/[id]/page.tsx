"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth-modal";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Sparkles, User, Users, Clock, Trophy, TrendingUp, Award, Coins, Trash2, Edit2, Share2, Crown, Star, UserPlus } from "lucide-react";
import { WagerInviteDialog } from "@/components/wager-invite-dialog";
import { BackButton } from "@/components/back-button";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { utcToLocal, localToUTC, isDeadlineElapsed, getTimeRemaining } from "@/lib/deadline-utils";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";
import { DeadlineDisplay } from "@/components/deadline-display";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";

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
  short_id?: string | null;
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
  const { user } = useAuth();
  const [wager, setWager] = useState<Wager | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sideCount, setSideCount] = useState({ a: 0, b: 0 });
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showUnjoinDialog, setShowUnjoinDialog] = useState(false);
  const [showChangeSideDialog, setShowChangeSideDialog] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);
  const [newSide, setNewSide] = useState<"a" | "b" | null>(null);
  const [unjoining, setUnjoining] = useState(false);
  const [changingSide, setChangingSide] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    sideA: "",
    sideB: "",
    amount: "",
    deadline: "",
  });
  const { toast } = useToast();
  
  // A/B Testing
  const buttonVariant = useMemo(() => getVariant(AB_TESTS.BUTTON_STYLE), []);

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWager = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;

    // No cache or forced refresh - fetch from API
    // Support both UUID and short_id
    const isUUID = wagerId.length === 36 && wagerId.includes('-');
    const query = isUUID 
      ? supabase.from("wagers").select("*").eq("id", wagerId)
      : supabase.from("wagers").select("*").eq("short_id", wagerId);
    
    const { data: wagerData, error } = await query
      .single();

    if (error || !wagerData) {
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    // Use the actual UUID for cache key and entry queries (not short_id)
    const actualWagerId = wagerData.id;
    
    // Always fetch fresh data (no cache)
    // For private wagers, allow access via direct link (simple sharing)
    // Anyone with the link can access private wagers
    // This enables simple sharing via WhatsApp, etc.

    setWager(wagerData);

    // Use actual UUID (not short_id) to fetch entries
    const { data: entriesData } = await supabase
      .from("wager_entries")
      .select("*")
      .eq("wager_id", actualWagerId);

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
      
      // Calculate actual amounts wagered on each side (for accurate return calculations)
      const sideATotal = entriesData
        .filter((e: Entry) => e.side === "a")
        .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
      const sideBTotal = entriesData
        .filter((e: Entry) => e.side === "b")
        .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
      
      // Store totals for calculations
      (wagerData as any).sideATotal = sideATotal;
      (wagerData as any).sideBTotal = sideBTotal;

      // Fetch usernames for all participants
      const uniqueUserIds = [...new Set(entriesData.map((e: Entry) => e.user_id))];
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", uniqueUserIds);
        
        if (profiles) {
          const userNameMap: Record<string, string> = {};
          profiles.forEach((profile: { id: string; username: string }) => {
            userNameMap[profile.id] = profile.username || `User ${profile.id.slice(0, 8)}`;
          });
          setUserNames(userNameMap);
        }
      }

    }
    setLoading(false);
    fetchingRef.current = false;
  }, [wagerId, supabase, user]);

  // Debounced refetch function for subscriptions
  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchWager(true);
    }, 1000); // Debounce by 1 second
  }, [fetchWager]);

  // Use deadline countdown hook
  const deadlineCountdown = useDeadlineCountdown(wager?.deadline);
  const deadlineStatus = deadlineCountdown.status;
  const deadlineHasElapsed = deadlineCountdown.hasElapsed;
  const deadlineCountdownText = deadlineCountdown.countdown;
  
  // Check if within 20 seconds of deadline (cutoff)
  const isWithinCutoff = useMemo(() => {
    if (!wager?.deadline) return false;
    const timeRemaining = getTimeRemaining(wager.deadline);
    return timeRemaining > 0 && timeRemaining <= 20000; // 20 seconds = 20000ms
  }, [wager?.deadline]);
  
  // Check if user has already joined
  const userEntry = useMemo(() => {
    if (!user || !entries.length) return null;
    return entries.find(entry => entry.user_id === user.id) || null;
  }, [user, entries]);
  
  // Check if betting is allowed (not within 20 seconds cutoff and deadline hasn't passed)
  const canBet = useMemo(() => {
    if (!wager || wager.status !== "OPEN") return false;
    if (isDeadlineElapsed(wager.deadline)) return false;
    if (isWithinCutoff) return false;
    return true;
  }, [wager, isWithinCutoff]);

  // Check if user is the creator
  const isCreator = useMemo(() => {
    return user && wager && wager.creator_id === user.id;
  }, [user, wager]);

  // Calculate total won for settled wagers (must be before any conditional returns)
  const totalWon = useMemo(() => {
    if (!wager || wager.status !== "SETTLED" || !wager.winning_side) {
      return null;
    }
    // Calculate totals from entries
    const sideATotal = entries
      .filter((e: Entry) => e.side === "a")
      .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
    const sideBTotal = entries
      .filter((e: Entry) => e.side === "b")
      .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
    const totalPot = sideATotal + sideBTotal;
    const platformFee = totalPot * (wager.fee_percentage || PLATFORM_FEE_PERCENTAGE);
    return totalPot - platformFee;
  }, [wager, entries]);

  useEffect(() => {
    fetchWager();

    // Subscribe to real-time updates for wager entries
    const entriesChannel = supabase
      .channel(`wager-entries:${wagerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wager_entries", filter: `wager_id=eq.${wagerId}` },
        () => {
          debouncedRefetch();
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
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      entriesChannel.unsubscribe();
      wagerChannel.unsubscribe();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [wagerId, supabase]); // Removed fetchWager and debouncedRefetch from dependencies

  const handleJoinClick = (side: "a" | "b") => {
    if (!user) {
      setSelectedSide(side);
      setShowAuthModal(true);
      return;
    }

    if (!wager) return;

    // Check if user already has an entry
    if (userEntry) {
      // If user is on the same side
      if (userEntry.side === side) {
        // Creators cannot unjoin - they can only switch sides
        if (isCreator) {
          toast({
            title: "Switch sides instead",
            description: "As the creator, you cannot unjoin this wager. You can switch to the other side instead.",
            variant: "default",
          });
          return;
        }
        // Non-creators can unjoin
        setShowUnjoinDialog(true);
        return;
      }
      // If user is on different side, show change side dialog
      setNewSide(side);
      setShowChangeSideDialog(true);
      return;
    }

    // Show confirmation dialog for new join
    setSelectedSide(side);
    setShowJoinDialog(true);
  };

  const confirmJoin = async () => {
    if (!selectedSide || !wager || !user) return;

    setJoining(true);
    try {
      // Check if wager is still open
      if (wager.status !== "OPEN") {
        toast({
          title: "This wager is closed",
          description: "Bets are no longer being accepted for this wager.",
          variant: "destructive",
        });
        setJoining(false);
        setShowJoinDialog(false);
        return;
      }

      // Check if deadline has passed
      if (isDeadlineElapsed(wager.deadline)) {
        toast({
          title: "Too late to wager",
          description: "The deadline for this wager has already passed.",
          variant: "destructive",
        });
        setJoining(false);
        setShowJoinDialog(false);
        return;
      }

      // Check 20-second cutoff
      const timeRemaining = getTimeRemaining(wager.deadline);
      if (timeRemaining > 0 && timeRemaining <= 20000) {
        toast({
          title: "Too late to wager",
          description: "You cannot place bets within 20 seconds of the deadline.",
          variant: "destructive",
        });
        setJoining(false);
        setShowJoinDialog(false);
        return;
      }

      if (!wager) {
        setJoining(false);
        setShowJoinDialog(false);
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
          description: "You need more money in your wallet to place this wager.",
          variant: "destructive",
        });
        setJoining(false);
        return;
      }

      // Deduct balance
      if (!wager) {
        setJoining(false);
        return;
      }
      
      await supabase.rpc("increment_balance", {
        user_id: user.id,
        amt: -wager.amount,
      });

      // Add entry (use actual UUID, not short_id)
      const { error } = await supabase.from("wager_entries").insert({
        wager_id: wager.id,
        user_id: user.id,
        side: selectedSide,
        amount: wager.amount,
      });

      if (error) {
        // Check if it's a duplicate entry error
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: "Already joined",
            description: "You have already placed a wager on this wager.",
            variant: "destructive",
          });
          setJoining(false);
          return;
        }
        throw error;
      }

      // Add transaction with description
      if (!wager) {
        setJoining(false);
        return;
      }
      
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "wager_join",
        amount: -wager.amount,
        reference: wager.id,
        description: `Wager Entry: "${wager.title}" - Joined ${selectedSide === "a" ? wager.side_a : wager.side_b}`,
      });

      // Refresh wager data (use actual UUID, not short_id)
      const { data: wagerData } = await supabase
        .from("wagers")
        .select("*")
        .eq("id", wager.id)
        .single();

      if (wagerData) {
        setWager(wagerData);

        const { data: entriesData } = await supabase
          .from("wager_entries")
          .select("*")
          .eq("wager_id", wager.id);

        if (entriesData) {
          setEntries(entriesData);
          const aCounts = entriesData.filter(
            (e: Entry) => e.side === "a"
          ).length;
          const bCounts = entriesData.filter(
            (e: Entry) => e.side === "b"
          ).length;
          setSideCount({ a: aCounts, b: bCounts });
          
          // Fetch usernames for all participants
          const uniqueUserIds = [...new Set(entriesData.map((e: Entry) => e.user_id))];
          if (uniqueUserIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, username")
              .in("id", uniqueUserIds);
            
            if (profiles) {
              const userNameMap: Record<string, string> = {};
              profiles.forEach((profile: { id: string; username: string }) => {
                userNameMap[profile.id] = profile.username || `User ${profile.id.slice(0, 8)}`;
              });
              setUserNames(userNameMap);
            }
          }
        }
      }

      trackABTestEvent(AB_TESTS.BUTTON_STYLE, buttonVariant, 'wager_joined', {
        wager_id: wager.id,
        side: selectedSide,
      });
      
      toast({
        title: "Success!",
        description: "You've successfully joined the wager.",
      });
      
      setShowJoinDialog(false);
      setSelectedSide(null);
    } catch (error) {
      console.error("Error joining wager:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Couldn't join the wager. Please try again.");
      
      toast({
        title: "Couldn't join wager",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleUnjoin = async () => {
    if (!user || !wager || !userEntry) return;

    setUnjoining(true);
    try {
      // Fetch fresh entries from database to ensure we have the latest data
      const { data: freshEntries, error: entriesError } = await supabase
        .from("wager_entries")
        .select("*")
        .eq("wager_id", wager.id);

      if (entriesError) {
        throw entriesError;
      }

      // Creators cannot unjoin at all - they can only switch sides
      const isCreatorCheck = wager.creator_id === user.id;
      
      if (isCreatorCheck) {
        toast({
          title: "Cannot unjoin",
          description: "As the creator, you cannot unjoin this wager. You can switch sides instead.",
          variant: "destructive",
        });
        setUnjoining(false);
        setShowUnjoinDialog(false);
        return;
      }

      // Verify the entry still exists and belongs to the user
      const currentEntry = (freshEntries || []).find(entry => entry.id === userEntry.id && entry.user_id === user.id);
      if (!currentEntry) {
        toast({
          title: "Entry not found",
          description: "This entry no longer exists or doesn't belong to you.",
          variant: "destructive",
        });
        setUnjoining(false);
        setShowUnjoinDialog(false);
        return;
      }

      // Check if deadline has passed
      if (isDeadlineElapsed(wager.deadline)) {
        toast({
          title: "Cannot unjoin",
          description: "The deadline has passed. You cannot unjoin this wager.",
          variant: "destructive",
        });
        setUnjoining(false);
        setShowUnjoinDialog(false);
        return;
      }

      // Check 20-second cutoff
      const timeRemaining = getTimeRemaining(wager.deadline);
      if (timeRemaining > 0 && timeRemaining <= 20000) {
        toast({
          title: "Cannot unjoin",
          description: "You cannot unjoin within 20 seconds of the deadline.",
          variant: "destructive",
        });
        setUnjoining(false);
        setShowUnjoinDialog(false);
        return;
      }

      // Delete the entry (use currentEntry to ensure we have the latest data)
      const { error: deleteError } = await supabase
        .from("wager_entries")
        .delete()
        .eq("id", currentEntry.id)
        .eq("user_id", user.id);

      if (deleteError) {
        // If deletion fails, check if it's because entry doesn't exist
        if (deleteError.code === 'PGRST116' || deleteError.message?.includes('No rows')) {
          toast({
            title: "Entry not found",
            description: "This entry no longer exists.",
            variant: "destructive",
          });
          setUnjoining(false);
          setShowUnjoinDialog(false);
          await fetchWager(true);
          return;
        }
        throw deleteError;
      }

      // Refund the user (use currentEntry amount)
      const refundAmount = Number(currentEntry.amount);
      const { error: balanceError } = await supabase.rpc("increment_balance", {
        user_id: user.id,
        amt: refundAmount,
      });

      if (balanceError) {
        // If refund fails, try to restore the entry (though this is unlikely to succeed)
        console.error("Failed to refund balance, entry already deleted:", balanceError);
        throw new Error("Failed to refund balance. Please contact support.");
      }

      // Record transaction (use currentEntry amount)
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "wager_refund",
        amount: refundAmount,
        reference: wager.id,
        description: `Unjoined Wager: "${wager.title}" - Entry refunded`,
      });

      toast({
        title: "Unjoined successfully",
        description: "You have been removed from this wager and your entry has been refunded.",
      });

      // Refresh wager data
      await fetchWager(true);
      setShowUnjoinDialog(false);
    } catch (error) {
      console.error("Error unjoining wager:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Couldn't unjoin the wager. Please try again.");
      
      toast({
        title: "Couldn't unjoin wager",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUnjoining(false);
    }
  };

  const handleChangeSide = async () => {
    if (!user || !wager || !userEntry || !newSide) return;

    setChangingSide(true);
    try {
      // Normalize side value to lowercase
      const normalizedSide = newSide.toLowerCase();
      if (normalizedSide !== 'a' && normalizedSide !== 'b') {
        toast({
          title: "Invalid side",
          description: "Side must be 'a' or 'b'.",
          variant: "destructive",
        });
        setChangingSide(false);
        setShowChangeSideDialog(false);
        return;
      }

      // Check if deadline has passed
      if (isDeadlineElapsed(wager.deadline)) {
        toast({
          title: "Cannot change side",
          description: "The deadline has passed. You cannot change your side.",
          variant: "destructive",
        });
        setChangingSide(false);
        setShowChangeSideDialog(false);
        return;
      }

      // Check 20-second cutoff
      const timeRemaining = getTimeRemaining(wager.deadline);
      if (timeRemaining > 0 && timeRemaining <= 20000) {
        toast({
          title: "Cannot change side",
          description: "You cannot change your side within 20 seconds of the deadline.",
          variant: "destructive",
        });
        setChangingSide(false);
        setShowChangeSideDialog(false);
        return;
      }

      // Fetch fresh entry to ensure it still exists
      const { data: freshEntry, error: fetchError } = await supabase
        .from("wager_entries")
        .select("*")
        .eq("id", userEntry.id)
        .eq("user_id", user.id)
        .single();

      if (fetchError || !freshEntry) {
        toast({
          title: "Entry not found",
          description: "This entry no longer exists or doesn't belong to you.",
          variant: "destructive",
        });
        setChangingSide(false);
        setShowChangeSideDialog(false);
        await fetchWager(true);
        return;
      }

      // Check if already on the requested side
      if (freshEntry.side === normalizedSide) {
        toast({
          title: "Already on this side",
          description: `You are already on ${normalizedSide === "a" ? wager.side_a : wager.side_b}.`,
          variant: "default",
        });
        setChangingSide(false);
        setShowChangeSideDialog(false);
        return;
      }

      // Update the entry side (use freshEntry.id to ensure we have the correct ID)
      const { data: updatedEntries, error: updateError } = await supabase
        .from("wager_entries")
        .update({ side: normalizedSide })
        .eq("id", freshEntry.id)
        .eq("user_id", user.id)
        .select();

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }

      // Verify the update succeeded - check if any rows were updated
      if (!updatedEntries || updatedEntries.length === 0) {
        throw new Error("No entry was updated. The entry may not exist or may have been deleted.");
      }

      const updatedEntry = updatedEntries[0];
      if (updatedEntry.side !== normalizedSide) {
        throw new Error("Failed to update side. Please try again.");
      }

      toast({
        title: "Side changed",
        description: `You've switched to ${normalizedSide === "a" ? wager.side_a : wager.side_b}.`,
      });

      // Refresh wager data to get updated entries
      await fetchWager(true);
      setShowChangeSideDialog(false);
      setNewSide(null);
    } catch (error) {
      console.error("Error changing side:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Couldn't change your side. Please try again.");
      
      toast({
        title: "Couldn't change side",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setChangingSide(false);
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

    // Check if deadline has elapsed
    if (isDeadlineElapsed(wager.deadline)) {
      toast({
        title: "Cannot delete",
        description: "This wager has expired and cannot be deleted. It must be resolved instead.",
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
          reference: wager.id,
          description: `Wager Deleted: "${wager.title}" - Creator deleted wager, entry refunded`,
        });
      }

      // Delete the wager (cascade will delete all entries) - use actual UUID, not short_id
      const { error } = await supabase
        .from("wagers")
        .delete()
        .eq("id", wager.id)
        .eq("creator_id", user.id);

      if (error) throw error;

      toast({
        title: "Wager deleted",
        description: "Your wager has been deleted successfully.",
      });

      // Redirect to home page
      router.push("/wagers");
      router.refresh();
    } catch (error) {
      console.error("Error deleting wager:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Couldn't delete the wager. Please try again.");
      
      toast({
        title: "Couldn't delete wager",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!user || !wager) return;

    // Check if user is the creator
    if (wager.creator_id !== user.id) {
      toast({
        title: "Unauthorized",
        description: "Only the creator can edit this wager.",
        variant: "destructive",
      });
      return;
    }

    // Check if wager is still open
    if (wager.status !== "OPEN") {
      toast({
        title: "Cannot edit",
        description: "Only open wagers can be edited.",
        variant: "destructive",
      });
      return;
    }

    // Check if there are entries from other users
    const otherUserEntries = entries.filter(entry => entry.user_id !== user.id);
    if (otherUserEntries.length > 0) {
      toast({
        title: "Cannot edit",
        description: "This wager cannot be edited because other users have placed bets on it.",
        variant: "destructive",
      });
      return;
    }

    // Initialize edit form with current wager data
    // Convert UTC deadline to local timezone for datetime-local input
    setEditFormData({
      title: wager.title,
      description: wager.description || "",
      sideA: wager.side_a,
      sideB: wager.side_b,
      amount: wager.amount.toString(),
      deadline: utcToLocal(wager.deadline),
    });
    setShowEditDialog(true);
  };

  const confirmEdit = async () => {
    if (!user || !wager) return;

    setEditing(true);

    try {
      // Validate form data
      const trimmedTitle = editFormData.title.trim();
      if (!trimmedTitle || trimmedTitle.length < 5) {
        toast({
          title: "Invalid title",
          description: "Title must be at least 5 characters.",
          variant: "destructive",
        });
        setEditing(false);
        return;
      }

      const trimmedSideA = editFormData.sideA.trim();
      const trimmedSideB = editFormData.sideB.trim();
      if (!trimmedSideA || !trimmedSideB || trimmedSideA.length < 2 || trimmedSideB.length < 2) {
        toast({
          title: "Invalid sides",
          description: "Both sides must be at least 2 characters.",
          variant: "destructive",
        });
        setEditing(false);
        return;
      }

      const newAmount = parseFloat(editFormData.amount);
      if (isNaN(newAmount) || newAmount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Amount must be a positive number.",
          variant: "destructive",
        });
        setEditing(false);
        return;
      }

      // Handle balance adjustment if entry fee changed
      const oldAmount = wager.amount;
      const amountDifference = newAmount - oldAmount;

      if (amountDifference !== 0) {
        // Check user balance if increasing
        if (amountDifference > 0) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("balance")
            .eq("id", user.id)
            .single();

          if (!profile || profile.balance < amountDifference) {
            toast({
              title: "Insufficient balance",
              description: `You need ${formatCurrency(amountDifference, (wager.currency || DEFAULT_CURRENCY) as Currency)} to increase the entry fee. Your current balance is ${formatCurrency(profile?.balance || 0, (wager.currency || DEFAULT_CURRENCY) as Currency)}.`,
              variant: "destructive",
            });
            setEditing(false);
            return;
          }

          // Deduct the difference
          await supabase.rpc("increment_balance", {
            user_id: user.id,
            amt: -amountDifference,
          });

          // Record transaction
          await supabase.from("transactions").insert({
            user_id: user.id,
            type: "wager_edit",
            amount: -amountDifference,
            reference: wager.id,
            description: `Wager Entry Fee Increased: "${wager.title}" - Entry fee increased from ${formatCurrency(oldAmount, (wager.currency || DEFAULT_CURRENCY) as Currency)} to ${formatCurrency(newAmount, (wager.currency || DEFAULT_CURRENCY) as Currency)}`,
          });
        } else {
          // Refund the difference (amount decreased)
          await supabase.rpc("increment_balance", {
            user_id: user.id,
            amt: Math.abs(amountDifference),
          });

          // Record transaction
          await supabase.from("transactions").insert({
            user_id: user.id,
            type: "wager_edit",
            amount: Math.abs(amountDifference),
            reference: wager.id,
            description: `Wager Entry Fee Decreased: "${wager.title}" - Entry fee decreased from ${formatCurrency(oldAmount, (wager.currency || DEFAULT_CURRENCY) as Currency)} to ${formatCurrency(newAmount, (wager.currency || DEFAULT_CURRENCY) as Currency)}`,
          });
        }
      }

      // Update the wager (use actual UUID, not short_id)
      const { error } = await supabase
        .from("wagers")
        .update({
          title: trimmedTitle,
          description: editFormData.description.trim() || null,
          side_a: trimmedSideA,
          side_b: trimmedSideB,
          amount: newAmount,
      // Convert local datetime to UTC for storage
      deadline: localToUTC(editFormData.deadline),
        })
        .eq("id", wager.id)
        .eq("creator_id", user.id);

      if (error) throw error;

      toast({
        title: "Wager updated",
        description: "Your wager has been updated successfully.",
      });

      // Refresh wager data
      await fetchWager(true);
      setShowEditDialog(false);
    } catch (error) {
      console.error("Error editing wager:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Couldn't update the wager. Please try again.");
      
      toast({
        title: "Couldn't update wager",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setEditing(false);
    }
  };

  const handleShare = async () => {
    if (typeof window === 'undefined' || !wager) return;
    
    // Use short_id if available, otherwise fall back to UUID
    const shareId = wager.short_id || wager.id;
    const wagerUrl = `${window.location.origin}/wager/${shareId}`;
    
    try {
      await navigator.clipboard.writeText(wagerUrl);
      toast({
        title: "Link copied!",
        description: "Wager link has been copied to your clipboard. Share it via WhatsApp or any platform.",
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = wagerUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast({
          title: "Link copied!",
          description: "Wager link has been copied to your clipboard. Share it via WhatsApp or any platform.",
        });
      } catch (err) {
        toast({
          title: "Couldn't copy link",
          description: "Please copy the link manually from the address bar.",
          variant: "destructive",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground">Loading wager...</p>
        </div>
      </main>
    );
  }

  if (!wager) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground">Wager not found</p>
        </div>
      </main>
    );
  }

  const totalParticipants = sideCount.a + sideCount.b;
  const sideAPercentage = totalParticipants > 0 ? (sideCount.a / totalParticipants) * 100 : 50;
  const sideBPercentage = totalParticipants > 0 ? (sideCount.b / totalParticipants) * 100 : 50;
  
  // Calculate actual amounts wagered on each side
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
    feePercentage: wager.fee_percentage || PLATFORM_FEE_PERCENTAGE,
  });

  // Check if wager is settled (for display logic)
  const isSettled = wager.status === "SETTLED";

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          if (selectedSide && user) {
            setShowJoinDialog(true);
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

      <ConfirmDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
        title="Confirm Join Wager"
        description={
          wager && selectedSide
            ? `Are you sure you want to join "${wager.title}" on ${selectedSide === "a" ? wager.side_a : wager.side_b}? This will deduct ${formatCurrency(wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)} from your balance.`
            : "Are you sure you want to join this wager?"
        }
        confirmText="Join"
        cancelText="Cancel"
        onConfirm={confirmJoin}
      />

      <ConfirmDialog
        open={showUnjoinDialog}
        onOpenChange={setShowUnjoinDialog}
        title="Unjoin Wager"
        description={
          wager && userEntry
            ? `Are you sure you want to unjoin "${wager.title}"? You will receive a refund of ${formatCurrency(userEntry.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}.`
            : "Are you sure you want to unjoin this wager?"
        }
        confirmText="Unjoin"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleUnjoin}
      />

      <ConfirmDialog
        open={showChangeSideDialog}
        onOpenChange={setShowChangeSideDialog}
        title="Change Side"
        description={
          wager && newSide
            ? `Are you sure you want to switch from ${userEntry?.side === "a" ? wager.side_a : wager.side_b} to ${newSide === "a" ? wager.side_a : wager.side_b}?`
            : "Are you sure you want to change your side?"
        }
        confirmText="Change Side"
        cancelText="Cancel"
        onConfirm={handleChangeSide}
      />

      {/* Edit Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-4 md:p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl md:text-2xl font-bold mb-4">Edit Wager</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  maxLength={1000}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Side A *</label>
                  <input
                    type="text"
                    value={editFormData.sideA}
                    onChange={(e) => setEditFormData({ ...editFormData, sideA: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Side B *</label>
                  <input
                    type="text"
                    value={editFormData.sideB}
                    onChange={(e) => setEditFormData({ ...editFormData, sideB: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    maxLength={100}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Entry Amount *</label>
                <input
                  type="number"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  min="1"
                  step="0.01"
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {wager && parseFloat(editFormData.amount) !== wager.amount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {parseFloat(editFormData.amount) > wager.amount
                      ? `You'll need to add ${formatCurrency(parseFloat(editFormData.amount) - wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)} to your wallet.`
                      : `You'll receive a refund of ${formatCurrency(wager.amount - parseFloat(editFormData.amount), (wager.currency || DEFAULT_CURRENCY) as Currency)}.`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  value={editFormData.deadline}
                  onChange={(e) => setEditFormData({ ...editFormData, deadline: e.target.value })}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditDialog(false)}
                disabled={editing}
                className="flex-1 px-4 py-2 text-sm border border-input rounded-lg hover:bg-muted transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmEdit}
                disabled={editing}
                className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {editing ? "Updating..." : "Update Wager"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header Section */}
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3 mb-3 md:mb-4">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <BackButton fallbackHref="/wagers" />
              <h1 className="text-xl md:text-4xl font-bold flex-1 break-words">{wager.title}</h1>
              {/* Edit and Delete Buttons - Only show for creator when no other users have wagered and deadline hasn't elapsed */}
              {user && wager.creator_id === user.id && wager.status === "OPEN" && entries.filter(e => e.user_id !== user.id).length === 0 && !isDeadlineElapsed(wager.deadline) && (
                <>
                  <button
                    onClick={handleEdit}
                    disabled={editing}
                    className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition active:scale-[0.98] touch-manipulation disabled:opacity-50 flex-shrink-0"
                    title="Edit wager"
                  >
                    <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="text-[10px] md:text-xs font-medium hidden sm:inline">Edit</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition active:scale-[0.98] touch-manipulation disabled:opacity-50 flex-shrink-0"
                    title="Delete wager"
                  >
                    <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="text-[10px] md:text-xs font-medium hidden sm:inline">Delete</span>
                  </button>
                </>
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
                    : wager.status === "RESOLVED" || wager.status === "SETTLED"
                      ? "bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                      : "bg-gray-500/20 text-gray-700 dark:text-gray-400 border border-gray-500/30"
                }`}
              >
                {wager.status === "SETTLED" ? "Settled" : wager.status === "RESOLVED" ? "Resolved" : wager.status}
              </span>
              {/* Share & Invite buttons - available for all wagers */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition active:scale-[0.98] touch-manipulation flex-shrink-0"
                  title="Copy wager link"
                >
                  <Share2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="text-[10px] md:text-xs font-medium hidden sm:inline">Share</span>
                </button>
                {user && (
                  <button
                    onClick={() => setShowInviteDialog(true)}
                    className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 border border-primary transition active:scale-[0.98] touch-manipulation flex-shrink-0"
                    title="Invite people to wager"
                  >
                    <UserPlus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="text-[10px] md:text-xs font-medium hidden sm:inline">Invite</span>
                  </button>
                )}
              </div>
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
            {isSettled && totalWon !== null ? (
              <div className="bg-card border-2 border-green-500/30 rounded-lg p-3 md:p-4 bg-gradient-to-br from-green-500/10 to-green-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-400" />
                  <p className="text-[10px] md:text-xs text-green-700 dark:text-green-400 font-semibold">Total Won</p>
                </div>
                <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalWon, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <p className="text-[10px] md:text-xs text-muted-foreground">Entry Fee</p>
                </div>
                <p className="text-lg md:text-2xl font-bold">{formatCurrency(wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}</p>
              </div>
            )}
            {wager.deadline ? (
              <div className="bg-card border border-border rounded-lg p-3 md:p-4">
                <DeadlineDisplay 
                  deadline={wager.deadline} 
                  size="md"
                  showLabel={true}
                  cardFormat={true}
                />
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <p className="text-[10px] md:text-xs text-muted-foreground">Platform Fee</p>
                </div>
                <p className="text-lg md:text-2xl font-bold">{(wager.fee_percentage || PLATFORM_FEE_PERCENTAGE) * 100}%</p>
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
                {(wager.status === "RESOLVED" || wager.status === "SETTLED") && wager.winning_side === "a" && (
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
                  <>
                    {userEntry && userEntry.side === "a" ? (
                      isCreator ? (
                        // Creator: Only show switch side button
                        <button
                          onClick={() => {
                            setNewSide("b");
                            setShowChangeSideDialog(true);
                          }}
                          disabled={changingSide || !canBet}
                          className="w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl"
                        >
                          {changingSide ? "Changing..." : !canBet ? "Cannot Change" : `Switch to ${wager.side_b}`}
                        </button>
                      ) : (
                        // Non-creator: Show unjoin button
                        <button
                          onClick={() => setShowUnjoinDialog(true)}
                          disabled={unjoining || !canBet}
                          className="w-full bg-destructive text-destructive-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation"
                        >
                          {unjoining ? "Unjoining..." : !canBet ? "Cannot Unjoin" : "Unjoin"}
                        </button>
                      )
                    ) : userEntry && userEntry.side === "b" ? (
                      // User is on side B - only show switch button if they're NOT the creator
                      // Creators should only see switch button on the side they're currently on
                      isCreator ? (
                        // Creator on side B - don't show switch button on side A, show join button (disabled)
                        <button
                          onClick={() => handleJoinClick("a")}
                          disabled={true}
                          className="w-full bg-muted text-muted-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base opacity-50 cursor-not-allowed transition-all"
                        >
                          Already Joined
                        </button>
                      ) : (
                        // Non-creator on side B - show switch to A button
                        <button
                          onClick={() => {
                            setNewSide("a");
                            setShowChangeSideDialog(true);
                          }}
                          disabled={changingSide || !canBet}
                          className="w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl"
                        >
                          {changingSide ? "Changing..." : !canBet ? "Cannot Change" : `Switch to ${wager.side_a}`}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleJoinClick("a")}
                        disabled={joining || !canBet}
                        className={`w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl ${
                          buttonVariant === 'B' ? 'shadow-lg hover:shadow-xl' : ''
                        }`}
                      >
                        {!canBet ? (isWithinCutoff ? "Too Late (20s cutoff)" : "Deadline Passed") : joining ? "Joining..." : `Join ${wager.side_a}`}
                      </button>
                    )}
                  </>
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
                {(wager.status === "RESOLVED" || wager.status === "SETTLED") && wager.winning_side === "b" && (
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
                  <>
                    {userEntry && userEntry.side === "b" ? (
                      isCreator ? (
                        // Creator: Only show switch side button
                        <button
                          onClick={() => {
                            setNewSide("a");
                            setShowChangeSideDialog(true);
                          }}
                          disabled={changingSide || !canBet}
                          className="w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl"
                        >
                          {changingSide ? "Changing..." : !canBet ? "Cannot Change" : `Switch to ${wager.side_a}`}
                        </button>
                      ) : (
                        // Non-creator: Show unjoin button
                        <button
                          onClick={() => setShowUnjoinDialog(true)}
                          disabled={unjoining || !canBet}
                          className="w-full bg-destructive text-destructive-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation"
                        >
                          {unjoining ? "Unjoining..." : !canBet ? "Cannot Unjoin" : "Unjoin"}
                        </button>
                      )
                    ) : userEntry && userEntry.side === "a" ? (
                      // User is on side A - only show switch button if they're NOT the creator
                      // Creators should only see switch button on the side they're currently on
                      isCreator ? (
                        // Creator on side A - don't show switch button on side B, show join button (disabled)
                        <button
                          onClick={() => handleJoinClick("b")}
                          disabled={true}
                          className="w-full bg-muted text-muted-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base opacity-50 cursor-not-allowed transition-all"
                        >
                          Already Joined
                        </button>
                      ) : (
                        // Non-creator on side A - show switch to B button
                        <button
                          onClick={() => {
                            setNewSide("b");
                            setShowChangeSideDialog(true);
                          }}
                          disabled={changingSide || !canBet}
                          className="w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl"
                        >
                          {changingSide ? "Changing..." : !canBet ? "Cannot Change" : `Switch to ${wager.side_b}`}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleJoinClick("b")}
                        disabled={joining || !canBet}
                        className={`w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-lg font-bold text-sm md:text-base hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl ${
                          buttonVariant === 'B' ? 'shadow-lg hover:shadow-xl' : ''
                        }`}
                      >
                        {!canBet ? (isWithinCutoff ? "Too Late (20s cutoff)" : "Deadline Passed") : joining ? "Joining..." : `Join ${wager.side_b}`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resolved Status */}
        {(wager.status === "RESOLVED" || wager.status === "SETTLED") && wager.winning_side && (
          <div className="mb-4 md:mb-6 bg-gradient-to-r from-green-500/20 to-blue-500/20 border-2 border-green-500/30 rounded-xl p-4 md:p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
              <p className="text-base md:text-xl font-bold">
                Winner: <span className="text-primary">{wager.winning_side === "a" ? wager.side_a : wager.side_b}</span>
              </p>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {wager.status === "SETTLED" 
                ? "This wager has been settled and winnings have been distributed"
                : "This competition has been resolved"}
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
              {entries.map((entry) => {
                const isCreator = wager.creator_id === entry.user_id;
                const isWinner = (wager.status === "RESOLVED" || wager.status === "SETTLED") && 
                                 wager.winning_side && 
                                 entry.side === wager.winning_side.toLowerCase();
                
                return (
                  <div 
                    key={entry.id} 
                    className={`flex items-center justify-between p-2.5 md:p-3 rounded-lg hover:bg-muted/50 transition ${
                      isWinner ? "bg-green-500/10 border border-green-500/30" : 
                      isCreator ? "bg-blue-500/10 border border-blue-500/30" : 
                      "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full flex-shrink-0 ${
                        entry.side === "a" ? "bg-primary" : "bg-primary/60"
                      }`} />
                      <span className="text-xs md:text-sm font-medium text-foreground truncate">
                        {userNames[entry.user_id] || `User ${entry.user_id.slice(0, 8)}`}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isCreator && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[9px] md:text-[10px] font-semibold">
                            <Crown className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            Creator
                          </span>
                        )}
                        {isWinner && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-700 dark:text-green-400 text-[9px] md:text-[10px] font-semibold">
                            <Trophy className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            Winner
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        {entry.side === "a" ? wager.side_a : wager.side_b}
                      </span>
                    </div>
                    <span className="text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">
                      {formatCurrency(entry.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      {wager && (
        <WagerInviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          wagerId={wager.id}
          wagerTitle={wager.title}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </main>
  );
}
