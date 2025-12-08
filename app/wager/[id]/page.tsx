"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth-modal";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Sparkles, User, Users, Clock, Trophy, TrendingUp, Award, Coins, Trash2, Edit2, Share2, Crown, Star, UserPlus, MessageSquare, Activity } from "lucide-react";
import { WagerInviteDialog } from "@/components/wager-invite-dialog";
import { BackButton } from "@/components/back-button";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { utcToLocal, localToUTC, isDeadlineElapsed, getTimeRemaining } from "@/lib/deadline-utils";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";
import { DeadlineDisplay } from "@/components/deadline-display";
import { PLATFORM_FEE_PERCENTAGE, WAGER_CATEGORIES } from "@/lib/constants";
import { WagerComments } from "@/components/wager-comments";
import { useSettings } from "@/hooks/use-settings";
import { WagerActivities } from "@/components/wager-activities";
import { WagerParticipants } from "@/components/wager-participants";
import { wagersApi, walletApi } from "@/lib/api-client";

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
  category?: string | null;
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
  const { user } = useAuth();
  const { getSetting } = useSettings();
  const defaultPlatformFee = getSetting('fees.wager_platform_fee_percentage', PLATFORM_FEE_PERCENTAGE) as number;
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
  const [activeTab, setActiveTab] = useState<"comments" | "participants" | "activities">("comments");
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    sideA: "",
    sideB: "",
    amount: "",
    deadline: "",
    category: "",
  });
  const { toast } = useToast();
  
  // A/B Testing
  const buttonVariant = useMemo(() => getVariant(AB_TESTS.BUTTON_STYLE), []);

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchWagerRef = useRef<((force?: boolean) => Promise<void>) | null>(null);

  const fetchWager = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;

    try {
      // Fetch wager from NestJS API (supports both UUID and short_id)
      const response = await wagersApi.get(wagerId);
      
      if (!response || !response.wager) {
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      const wagerData = response.wager;
      
      // Extract category slug if category is an object
      if (wagerData.category && typeof wagerData.category === 'object') {
        wagerData.category = wagerData.category.slug || wagerData.category.label?.toLowerCase().replace(/\s+/g, '-') || null;
      }

      // Check if wager is private and user is not the creator
      if (!wagerData.is_public && wagerData.creator_id) {
        if (user && user.id) {
          const creatorId = String(wagerData.creator_id).trim().toLowerCase();
          const userId = String(user.id).trim().toLowerCase();
          
          if (creatorId && userId && creatorId !== userId) {
            console.log('Blocking access in fetchWager - user is not the creator');
            setLoading(false);
            fetchingRef.current = false;
            toast({
              title: "Private Wager",
              description: "This wager is private and only visible to its creator.",
              variant: "destructive",
            });
            router.push('/wagers');
            return;
          }
        }
      }

      setWager(wagerData);

      // Extract entries from wager response (backend returns entries.sideA and entries.sideB)
      const allEntries: Entry[] = [
        ...(wagerData.entries?.sideA || []),
        ...(wagerData.entries?.sideB || [])
      ];

      if (allEntries.length > 0) {
        setEntries(allEntries);
        
        // Use entryCounts from backend response
        const entryCounts = wagerData.entryCounts || { sideA: 0, sideB: 0, total: 0 };
        setSideCount({ a: entryCounts.sideA, b: entryCounts.sideB });
        
        // Calculate actual amounts wagered on each side
        const sideATotal = allEntries
          .filter((e: Entry) => e.side === "a")
          .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
        const sideBTotal = allEntries
          .filter((e: Entry) => e.side === "b")
          .reduce((sum: number, e: Entry) => sum + Number(e.amount), 0);
        
        // Store totals for calculations
        (wagerData as any).sideATotal = sideATotal;
        (wagerData as any).sideBTotal = sideBTotal;

        // Extract usernames from entries (backend includes user relation)
        const userNameMap: Record<string, string> = {};
        allEntries.forEach((entry: any) => {
          if (entry.user) {
            userNameMap[entry.user_id] = entry.user.username || entry.user.email?.split('@')[0] || `User ${entry.user_id.slice(0, 8)}`;
          } else {
            userNameMap[entry.user_id] = `User ${entry.user_id.slice(0, 8)}`;
          }
        });
        setUserNames(userNameMap);
      } else {
        setEntries([]);
        setSideCount({ a: 0, b: 0 });
        setUserNames({});
      }
    } catch (error) {
      console.error('Error fetching wager:', error);
      toast({
        title: "Error",
        description: "Failed to load wager. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [wagerId, user, toast, router]); // Removed 'wager' from dependencies to prevent infinite loop

  // Update ref whenever fetchWager changes
  useEffect(() => {
    fetchWagerRef.current = fetchWager;
  }, [fetchWager]);

  // Debounced refetch function for subscriptions
  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      if (fetchWagerRef.current) {
        fetchWagerRef.current(true);
      }
    }, 1000); // Debounce by 1 second
  }, []);

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
    const platformFee = totalPot * (wager.fee_percentage || defaultPlatformFee);
    return totalPot - platformFee;
  }, [wager, entries]);

  useEffect(() => {
    // Initial fetch
    fetchWager();

    // Poll for updates every 30 seconds (replaces real-time subscriptions)
    // Use a longer interval to reduce API calls
    const pollInterval = setInterval(() => {
      if (fetchWagerRef.current && !fetchingRef.current) {
        fetchWagerRef.current(true);
      }
    }, 30000); // 30 seconds

    // Listen for custom wager update events
    const handleWagerUpdate = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        if (fetchWagerRef.current && !fetchingRef.current) {
          fetchWagerRef.current(true);
        }
      }, 1000); // Debounce by 1 second
    };
    window.addEventListener('wager-updated', handleWagerUpdate);
    window.addEventListener('balance-updated', handleWagerUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('wager-updated', handleWagerUpdate);
      window.removeEventListener('balance-updated', handleWagerUpdate);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [wagerId]); // Only depend on wagerId to prevent unnecessary re-runs

  // Re-validate access when user loads (in case wager was fetched before user was available)
  // Use a ref to track if we've already checked to prevent multiple redirects
  const accessCheckRef = useRef<string | null>(null);
  const hasRedirectedRef = useRef(false);
  
  useEffect(() => {
    // Don't do anything if we've already redirected
    if (hasRedirectedRef.current) {
      console.log('Already redirected, skipping check');
      return;
    }
    
    // Skip if we've already checked this wager/user combination
    const checkKey = `${wager?.id}-${user?.id}`;
    if (accessCheckRef.current === checkKey) {
      console.log('Skipping duplicate access check');
      return;
    }
    
    // Only check if we have all required data
    if (user && user.id && wager && !wager.is_public && wager.creator_id) {
      // Convert both to strings and trim for comparison
      const creatorId = String(wager.creator_id).trim().toLowerCase();
      const userId = String(user.id).trim().toLowerCase();
      
      // Debug: Log the comparison
      console.log('Private wager access validation in useEffect:', {
        creatorId,
        userId,
        match: creatorId === userId,
        wagerId: wager.id,
        wagerTitle: wager.title
      });
      
      // Mark as checked first
      accessCheckRef.current = checkKey;
      
      // Only redirect if IDs definitely don't match
      if (creatorId && userId && creatorId !== userId) {
        console.log('BLOCKING access - user is NOT the creator, redirecting...');
        hasRedirectedRef.current = true;
        toast({
          title: "Private Wager",
          description: "This wager is private and only visible to its creator.",
          variant: "destructive",
        });
        router.push('/wagers');
      } else {
        // User is the creator - allow access (no redirect)
        console.log('ALLOWING access - user IS the creator, IDs match');
        // Don't set hasRedirectedRef - allow access
      }
    } else {
      console.log('Missing data for access check:', {
        hasUser: !!user,
        hasUserId: !!(user && user.id),
        hasWager: !!wager,
        isPublic: wager?.is_public,
        hasCreatorId: !!wager?.creator_id
      });
    }
  }, [user, wager, toast, router]);
  
  // Reset check refs when wager ID changes
  useEffect(() => {
    accessCheckRef.current = null;
    hasRedirectedRef.current = false;
  }, [wagerId]);

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

      // Join wager via API route (proxies to NestJS backend)
      const response = await fetch(`/api/wagers/${wager.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ side: selectedSide }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || data.message || 'Failed to join wager');
      }

      trackABTestEvent(AB_TESTS.BUTTON_STYLE, buttonVariant, 'wager_joined', {
        wager_id: wager.id,
        side: selectedSide,
      });
      
      toast({
        title: "Success!",
        description: "You've successfully joined the wager.",
      });
      
      // Dispatch events to update UI
      window.dispatchEvent(new CustomEvent('balance-updated'));
      window.dispatchEvent(new CustomEvent('wager-updated'));
      
      // Refresh wager data
      await fetchWager(true);
      
      setShowJoinDialog(false);
      setSelectedSide(null);
    } catch (error) {
      console.error("Error joining wager:", error);
      const errorMessage = error instanceof Error ? error.message : "Couldn't join the wager. Please try again.";
      
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
      // Creators cannot unjoin at all - they can only switch sides
      if (wager.creator_id === user.id) {
        toast({
          title: "Cannot unjoin",
          description: "As the creator, you cannot unjoin this wager. You can switch sides instead.",
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

      // TODO: Backend endpoint needed - POST /wagers/:id/unjoin
      // For now, call API route that will need backend implementation
      const response = await fetch(`/api/wagers/${wager.id}/unjoin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || data.message || 'Failed to unjoin wager');
      }

      toast({
        title: "Unjoined successfully",
        description: "You have been removed from this wager and your entry has been refunded.",
      });

      // Dispatch event to update balance
      window.dispatchEvent(new CustomEvent('balance-updated'));
      window.dispatchEvent(new CustomEvent('wager-updated'));

      // Refresh wager data
      await fetchWager(true);
      setShowUnjoinDialog(false);
    } catch (error) {
      console.error("Error unjoining wager:", error);
      const errorMessage = error instanceof Error ? error.message : "Couldn't unjoin the wager. Please try again.";
      
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

      // Check if already on the requested side
      if (userEntry.side === normalizedSide) {
        toast({
          title: "Already on this side",
          description: `You are already on ${normalizedSide === "a" ? wager.side_a : wager.side_b}.`,
          variant: "default",
        });
        setChangingSide(false);
        setShowChangeSideDialog(false);
        return;
      }

      // TODO: Backend endpoint needed - PATCH /wagers/:id/entry or POST /wagers/:id/change-side
      // For now, call API route that will need backend implementation
      const response = await fetch(`/api/wagers/${wager.id}/change-side`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ side: normalizedSide }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || data.message || 'Failed to change side');
      }

      toast({
        title: "Side changed",
        description: `You've switched to ${normalizedSide === "a" ? wager.side_a : wager.side_b}.`,
      });

      // Dispatch event to update wager
      window.dispatchEvent(new CustomEvent('wager-updated'));

      // Refresh wager data to get updated entries
      await fetchWager(true);
      setShowChangeSideDialog(false);
      setNewSide(null);
    } catch (error) {
      console.error("Error changing side:", error);
      const errorMessage = error instanceof Error ? error.message : "Couldn't change your side. Please try again.";
      
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
      // Delete wager via NestJS API (handles refunds automatically)
      await wagersApi.delete(wager.id);

      toast({
        title: "Wager deleted",
        description: "Your wager has been deleted successfully.",
      });

      // Dispatch event to update balance
      window.dispatchEvent(new CustomEvent('balance-updated'));

      // Redirect to home page
      router.push("/wagers");
      router.refresh();
    } catch (error) {
      console.error("Error deleting wager:", error);
      const errorMessage = error instanceof Error ? error.message : "Couldn't delete the wager. Please try again.";
      
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
      category: wager.category || "",
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

      // TODO: Backend endpoint needed - PATCH /wagers/:id
      // For now, call API route that will need backend implementation
      const response = await fetch(`/api/wagers/${wager.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: trimmedTitle,
          description: editFormData.description.trim() || null,
          sideA: trimmedSideA,
          sideB: trimmedSideB,
          amount: newAmount,
          deadline: localToUTC(editFormData.deadline),
          category: editFormData.category || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || data.message || 'Failed to update wager');
      }

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
    feePercentage: wager.fee_percentage || defaultPlatformFee,
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

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">No category</option>
                  {WAGER_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
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

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
        {/* Header Section */}
        <div className="mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <BackButton fallbackHref="/wagers" />
              <h1 className="text-lg md:text-2xl font-bold flex-1 break-words">{wager.title}</h1>
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
              {/* Share & Invite buttons - only available before deadline */}
              {wager && !isDeadlineElapsed(wager.deadline) && (
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
              )}
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
                <p className="text-lg md:text-2xl font-bold">{(wager.fee_percentage || defaultPlatformFee) * 100}%</p>
                <p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5">
                  {formatCurrency(returns.platformFee, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Competition Arena - VS Layout */}
        <div className="mb-4">
          <div className="bg-gradient-to-br from-card via-card to-card/50 border border-border rounded-xl p-4 md:p-5 shadow-sm">
            {/* VS Header */}
            <div className="text-center mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary">COMPETITION</span>
              </div>
            </div>

            {/* Progress Bar */}
            {totalParticipants > 0 && (
              <div className="mb-4">
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
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {/* VS Divider - Desktop */}
              <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <div className="bg-background border-4 border-border rounded-full p-3 md:p-4 shadow-lg">
                  <span className="text-2xl md:text-4xl font-black text-muted-foreground">VS</span>
                </div>
              </div>

              {/* Side A */}
              <div className={`relative border-2 rounded-lg p-3 md:p-4 transition-all ${
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
                
                <div className="text-center mb-3">
                  <h3 className="text-base md:text-lg font-bold mb-2">{wager.side_a}</h3>
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xl md:text-2xl font-bold text-primary">{sideCount.a}</p>
                    <span className="text-xs text-muted-foreground">bettors</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {formatCurrency(sideAPot, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
                  </p>
                  {/* Potential Return for Side A */}
                  {wager.status === "OPEN" && sideCount.a > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 mb-2">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Coins className="h-3 w-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground">Potential Return</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-bold text-primary text-xs">
                          {formatReturnMultiplier(returns.sideAReturnMultiplier)}
                        </span>
                        <span className="text-[9px] text-green-600 dark:text-green-400 font-medium">
                          {formatReturnPercentage(returns.sideAReturnPercentage)}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        Win: {formatCurrency(returns.sideAPotential, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                      </p>
                    </div>
                  )}
                </div>

                {wager.status === "OPEN" && (
                  <>
                    {userEntry && userEntry.side === "a" ? (
                      isCreator ? (
                        <button
                          onClick={() => {
                            setNewSide("b");
                            setShowChangeSideDialog(true);
                          }}
                          disabled={changingSide || !canBet}
                          className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation min-h-[44px]"
                        >
                          {changingSide ? "Changing..." : !canBet ? "Cannot Change" : `Switch to ${wager.side_b}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowUnjoinDialog(true)}
                          disabled={unjoining || !canBet}
                          className="w-full bg-destructive text-destructive-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation min-h-[44px]"
                        >
                          {unjoining ? "Unjoining..." : !canBet ? "Cannot Unjoin" : "Unjoin"}
                        </button>
                      )
                    ) : userEntry && userEntry.side === "b" ? (
                      isCreator ? (
                        <button
                          onClick={() => handleJoinClick("a")}
                          disabled={true}
                          className="w-full bg-muted text-muted-foreground py-2.5 rounded-lg font-bold text-sm opacity-50 cursor-not-allowed transition-all min-h-[44px]"
                        >
                          Already Joined
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setNewSide("a");
                            setShowChangeSideDialog(true);
                          }}
                          disabled={changingSide || !canBet}
                          className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation min-h-[44px]"
                        >
                          {changingSide ? "Changing..." : !canBet ? "Cannot Change" : `Switch to ${wager.side_a}`}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleJoinClick("a")}
                        disabled={joining || !canBet}
                        className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation min-h-[44px]"
                      >
                        {!canBet ? (isWithinCutoff ? "Too Late" : "Deadline Passed") : joining ? "Joining..." : `Join ${wager.side_a}`}
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
              <div className={`relative border-2 rounded-lg p-3 md:p-4 transition-all ${
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
                
                <div className="text-center mb-3">
                  <h3 className="text-base md:text-lg font-bold mb-2">{wager.side_b}</h3>
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xl md:text-2xl font-bold text-primary">{sideCount.b}</p>
                    <span className="text-xs text-muted-foreground">bettors</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {formatCurrency(sideBPot, (wager.currency || DEFAULT_CURRENCY) as Currency)} total
                  </p>
                  {/* Potential Return for Side B */}
                  {wager.status === "OPEN" && sideCount.b > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 mb-2">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Coins className="h-3 w-3 text-primary" />
                        <span className="text-[9px] text-muted-foreground">Potential Return</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-bold text-primary text-xs">
                          {formatReturnMultiplier(returns.sideBReturnMultiplier)}
                        </span>
                        <span className="text-[9px] text-green-600 dark:text-green-400 font-medium">
                          {formatReturnPercentage(returns.sideBReturnPercentage)}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        Win: {formatCurrency(returns.sideBPotential, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                      </p>
                    </div>
                  )}
                </div>

                {wager.status === "OPEN" && (
                  <>
                    {userEntry && userEntry.side === "b" ? (
                      isCreator ? (
                        <button
                          onClick={() => {
                            setNewSide("a");
                            setShowChangeSideDialog(true);
                          }}
                          disabled={changingSide || !canBet}
                          className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation min-h-[44px]"
                        >
                          {changingSide ? "Changing..." : !canBet ? "Cannot Change" : `Switch to ${wager.side_a}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowUnjoinDialog(true)}
                          disabled={unjoining || !canBet}
                          className="w-full bg-destructive text-destructive-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation min-h-[44px]"
                        >
                          {unjoining ? "Unjoining..." : !canBet ? "Cannot Unjoin" : "Unjoin"}
                        </button>
                      )
                    ) : userEntry && userEntry.side === "a" ? (
                      isCreator ? (
                        <button
                          onClick={() => handleJoinClick("b")}
                          disabled={true}
                          className="w-full bg-muted text-muted-foreground py-2.5 rounded-lg font-bold text-sm opacity-50 cursor-not-allowed transition-all min-h-[44px]"
                        >
                          Already Joined
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setNewSide("b");
                            setShowChangeSideDialog(true);
                          }}
                          disabled={changingSide || !canBet}
                          className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation min-h-[44px]"
                        >
                          {changingSide ? "Changing..." : !canBet ? "Cannot Change" : `Switch to ${wager.side_b}`}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleJoinClick("b")}
                        disabled={joining || !canBet}
                        className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] touch-manipulation min-h-[44px]"
                      >
                        {!canBet ? (isWithinCutoff ? "Too Late" : "Deadline Passed") : joining ? "Joining..." : `Join ${wager.side_b}`}
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
          <div className="mb-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-lg p-3 md:p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm md:text-base font-bold">
                Winner: <span className="text-primary">{wager.winning_side === "a" ? wager.side_a : wager.side_b}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {wager.status === "SETTLED" 
                ? "This wager has been settled and winnings have been distributed"
                : "This competition has been resolved"}
            </p>
          </div>
        )}

        {/* Tabs Section */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Tabs Navigation */}
          <div className="flex border-b border-border bg-muted/30">
            <button
              onClick={() => setActiveTab("comments")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                activeTab === "comments"
                  ? "bg-background text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Comments</span>
            </button>
            <button
              onClick={() => setActiveTab("participants")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                activeTab === "participants"
                  ? "bg-background text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Participants</span>
              {totalParticipants > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === "participants"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {totalParticipants}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("activities")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                activeTab === "activities"
                  ? "bg-background text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Activities</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 md:p-6">
            {activeTab === "comments" && <WagerComments wagerId={wager.id} />}
            {activeTab === "participants" && (
              <WagerParticipants
                entries={entries}
                userNames={userNames}
                wager={{
                  creator_id: wager.creator_id,
                  status: wager.status,
                  winning_side: wager.winning_side,
                  side_a: wager.side_a,
                  side_b: wager.side_b,
                  currency: wager.currency,
                }}
              />
            )}
            {activeTab === "activities" && (
              <WagerActivities
                wagerId={wager.id}
                sideA={wager.side_a}
                sideB={wager.side_b}
              />
            )}
          </div>
        </div>
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
