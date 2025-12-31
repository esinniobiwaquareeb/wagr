"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth-modal";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Sparkles, User, Users, Clock, Trophy, TrendingUp, Coins, Trash2, Edit2, Share2, UserPlus, MessageSquare, Activity, Loader2, Flame, Check, X } from "lucide-react";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { WagerInviteDialog } from "@/components/wager-invite-dialog";
import { BackButton } from "@/components/back-button";
import { calculatePotentialReturns, formatReturnMultiplier, formatReturnPercentage } from "@/lib/wager-calculations";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { utcToLocal, localToUTC, isDeadlineElapsed, getTimeRemaining } from "@/lib/deadline-utils";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";
import { DeadlineDisplay } from "@/components/deadline-display";
import { PLATFORM_FEE_PERCENTAGE } from "@/lib/constants";
import { categoriesApi } from "@/lib/api-client";
import { WagerComments } from "@/components/wager-comments";
import { useSettings } from "@/hooks/use-settings";
import { WagerActivities } from "@/components/wager-activities";
import { WagerParticipants } from "@/components/wager-participants";
import { wagersApi, walletApi } from "@/lib/api-client";
import { Wager } from "@/lib/types/api";
import { logger } from "@/lib/logger";

interface Entry {
  id: string;
  side: string;
  amount: number;
  user_id: string;
  created_at: string;
}

// Format volume/pool display like Polymarket
function formatVolume(amount: number): string {
  if (amount >= 1000000) {
    return `₦${(amount / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  }
  if (amount >= 1000) {
    return `₦${(amount / 1000).toFixed(0)}k`;
  }
  return `₦${amount.toFixed(0)}`;
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
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);
  const [newSide, setNewSide] = useState<"a" | "b" | null>(null);
  const [unjoining, setUnjoining] = useState(false);
  const [changingSide, setChangingSide] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "participants" | "activities">("comments");
  const [categories, setCategories] = useState<Array<{
    id: string;
    slug: string;
    label: string;
    icon: string | null;
  }>>([]);
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
  const joiningRef = useRef(false);
  const changingSideRef = useRef(false);
  const unjoiningRef = useRef(false);

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
            logger.debug('Blocking access in fetchWager - user is not the creator');
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
        
        // Calculate side counts from entries (count of participants, not totals)
        const sideACount = allEntries.filter((e: Entry) => e.side === "a").length;
        const sideBCount = allEntries.filter((e: Entry) => e.side === "b").length;
        setSideCount({ a: sideACount, b: sideBCount });
        
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
      logger.error('Error fetching wager', error);
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

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesApi.list(false);
        if (response && response.categories) {
          const mappedCategories = response.categories
            .filter(cat => cat.is_active)
            .map(cat => ({
              id: cat.slug,
              slug: cat.slug,
              label: cat.label,
              icon: cat.icon || null,
            }));
          setCategories(mappedCategories);
        }
      } catch (error) {
        logger.error('Error fetching categories', error);
        setCategories([]);
      }
    };

    fetchCategories();
  }, []);

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

  // Check if user is the creator (using string comparison to handle UUID/string mismatches)
  const isCreator = useMemo(() => {
    if (!user || !wager || !user.id || !wager.creator_id) return false;
    // Normalize both IDs to strings for comparison
    const creatorId = String(wager.creator_id).trim();
    const userId = String(user.id).trim();
    return creatorId === userId;
  }, [user, wager]);

  // Creator can resolve when:
  // - They are the creator
  // - Wager is OPEN
  // - Winning side may or may not be set (creators can set it or settle if already set)
  // Note: Creators can resolve regardless of deadline (unlike regular users)
  const canCreatorResolve = useMemo(() => {
    if (!wager || !isCreator) return false;
    if (wager.status !== "OPEN") return false;
    // Creators can always resolve OPEN wagers (set winning side or settle if already set)
    return true;
  }, [wager, isCreator]);

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
      logger.debug('Already redirected, skipping check');
      return;
    }
    
    // Skip if we've already checked this wager/user combination
    const checkKey = `${wager?.id}-${user?.id}`;
    if (accessCheckRef.current === checkKey) {
      logger.debug('Skipping duplicate access check');
      return;
    }
    
    // Only check if we have all required data
    if (user && user.id && wager && !wager.is_public && wager.creator_id) {
      // Convert both to strings and trim for comparison
      const creatorId = String(wager.creator_id).trim().toLowerCase();
      const userId = String(user.id).trim().toLowerCase();
      
      // Debug: Log the comparison
      logger.debug('Private wager access validation in useEffect', {
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
        logger.debug('BLOCKING access - user is NOT the creator, redirecting...');
        hasRedirectedRef.current = true;
        toast({
          title: "Private Wager",
          description: "This wager is private and only visible to its creator.",
          variant: "destructive",
        });
        router.push('/wagers');
      } else {
        // User is the creator - allow access (no redirect)
        logger.debug('ALLOWING access - user IS the creator, IDs match');
        // Don't set hasRedirectedRef - allow access
      }
    } else {
      logger.debug('Missing data for access check', {
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
    if (!selectedSide || !wager || !user) {
      logger.warn("confirmJoin: Missing required data", { selectedSide, wager: !!wager, user: !!user });
      return;
    }

    // Prevent multiple simultaneous requests using ref (more reliable than state)
    if (joiningRef.current) {
      logger.warn("confirmJoin: Already joining, skipping duplicate request");
      return;
    }

    joiningRef.current = true;
    setJoining(true);
    
    try {
      logger.info("confirmJoin: Starting join process", { wagerId: wager.id, side: selectedSide });
      
      // Check if wager is still open
      if (wager.status !== "OPEN") {
        toast({
          title: "This wager is closed",
          description: "Bets are no longer being accepted for this wager.",
          variant: "destructive",
        });
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
        setShowJoinDialog(false);
        return;
      }

      logger.info("confirmJoin: Making API request", { url: `/api/wagers/${wager.id}/join`, side: selectedSide });
      
      // Join wager via API route (proxies to NestJS backend)
      const response = await fetch(`/api/wagers/${wager.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ side: selectedSide }),
      });

      logger.info("confirmJoin: API response received", { ok: response.ok, status: response.status });

      if (!response.ok) {
        const data = await response.json();
        logger.error("confirmJoin: API error", { status: response.status, data });
        throw new Error(data.error?.message || data.message || 'Failed to join wager');
      }

      const responseData = await response.json();
      logger.info("confirmJoin: Join successful", { data: responseData });

      trackABTestEvent(AB_TESTS.BUTTON_STYLE, buttonVariant, 'wager_joined', {
        wager_id: wager.id,
        side: selectedSide,
      });
      
      toast({
        title: "Success!",
        description: "You've successfully joined the wager.",
      });
      
      // Dispatch events to update UI
      // Dispatch balance-updated event to refresh balance in top nav
      // Add a small delay to ensure database transaction is committed
      if (typeof window !== 'undefined') {
        // Dispatch immediately
        window.dispatchEvent(new CustomEvent('balance-updated'));
        // Also dispatch after a short delay to ensure transaction is committed
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('balance-updated'));
        }, 300);
      }
      window.dispatchEvent(new CustomEvent('wager-updated'));
      
      // Refresh wager data
      await fetchWager(true);
      
      setShowJoinDialog(false);
      setSelectedSide(null);
    } catch (error) {
      logger.error("Error joining wager", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Couldn't join the wager. Please try again.");
      
      toast({
        title: "Couldn't join wager",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setJoining(false);
      joiningRef.current = false;
      logger.info("confirmJoin: Completed, ref reset");
    }
  };

  const handleUnjoin = async () => {
    if (!user || !wager || !userEntry) return;

    // Prevent multiple simultaneous requests using ref
    if (unjoiningRef.current) {
      logger.warn("handleUnjoin: Already unjoining, skipping duplicate request");
      return;
    }

    unjoiningRef.current = true;
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
      logger.error("Error unjoining wager", error);
      const errorMessage = error instanceof Error ? error.message : "Couldn't unjoin the wager. Please try again.";
      
      toast({
        title: "Couldn't unjoin wager",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUnjoining(false);
      unjoiningRef.current = false;
    }
  };

  const handleChangeSide = async () => {
    if (!user || !wager || !userEntry || !newSide) return;

    // Prevent multiple simultaneous requests using ref
    if (changingSideRef.current) {
      logger.warn("handleChangeSide: Already changing side, skipping duplicate request");
      return;
    }

    changingSideRef.current = true;
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
      logger.error("Error changing side", error);
      const errorMessage = error instanceof Error ? error.message : "Couldn't change your side. Please try again.";
      
      toast({
        title: "Couldn't change side",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setChangingSide(false);
      changingSideRef.current = false;
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
      logger.error("Error deleting wager", error);
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

  const handleResolve = () => {
    if (!canCreatorResolve) {
      toast({
        title: "Cannot resolve",
        description: "You can only resolve this wager while it is still open.",
        variant: "destructive",
      });
      return;
    }
    
    // If winning side is already set, settle directly without showing dialog
    if (wager?.winning_side && wager.winning_side.trim() !== "") {
      confirmResolve(wager.winning_side.toLowerCase() as "a" | "b");
      return;
    }
    
    setShowResolveDialog(true);
  };

  const confirmResolve = async (winningSide: "a" | "b") => {
    if (!user || !wager || resolving) return;

    setResolving(true);
    try {
      const response = await fetch(`/api/wagers/${wager.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winningSide }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message || data?.message || 'Failed to resolve wager');
      }

      const data = await response.json();
      
      toast({
        title: "Wager resolved",
        description: data.message || data.data?.message || `You set "${winningSide === "a" ? wager.side_a : wager.side_b}" as the winning side. Settlements will run shortly.`,
      });

      // Dispatch balance update event if settlement happened immediately
      if (data.message?.includes('settled') || data.data?.message?.includes('settled')) {
        window.dispatchEvent(new CustomEvent('balance-updated'));
      }

      window.dispatchEvent(new CustomEvent('wager-updated'));
      await fetchWager(true);
    } catch (error) {
      logger.error("Error resolving wager", error);
      const errorMessage = error instanceof Error ? error.message : "Couldn't resolve the wager. Please try again.";
      toast({
        title: "Couldn't resolve wager",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setResolving(false);
      setShowResolveDialog(false);
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
      category: (wager.category && typeof wager.category === 'object' 
        ? wager.category.slug || wager.category.id || ""
        : wager.category_id || ""),
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

      // Dispatch balance-updated event to refresh balance in top nav
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('balance-updated'));
      }

      // Refresh wager data
      await fetchWager(true);
      setShowEditDialog(false);
    } catch (error) {
      logger.error("Error editing wager", error);
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

  // Calculate total participants from entries count (not from sideCount which might be totals)
  const totalParticipants = entries.length;
  
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
  
  // Calculate probability percentages based on amounts (Polymarket style)
  const sideAPercent = totalPot > 0 ? Math.round((sideATotal / totalPot) * 100) : 50;
  const sideBPercent = totalPot > 0 ? 100 - sideAPercent : 50;

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

      {/* Resolve Dialog with Side Selection */}
      {showResolveDialog && wager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-4 md:p-6 max-w-md w-full mx-4">
            <h2 className="text-xl md:text-2xl font-bold mb-4">Resolve Wager</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Which side won "{wager.title}"? This will mark the wager as resolved and trigger settlement.
            </p>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  setSelectedSide("a");
                  confirmResolve("a");
                }}
                disabled={resolving}
                className="w-full p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-semibold text-lg mb-1 flex items-center gap-2">
                  Side A
                  {resolving && selectedSide === "a" && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <div className="text-sm text-muted-foreground">{wager.side_a}</div>
              </button>
              <button
                onClick={() => {
                  setSelectedSide("b");
                  confirmResolve("b");
                }}
                disabled={resolving}
                className="w-full p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-semibold text-lg mb-1 flex items-center gap-2">
                  Side B
                  {resolving && selectedSide === "b" && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <div className="text-sm text-muted-foreground">{wager.side_b}</div>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResolveDialog(false);
                  setSelectedSide(null);
                }}
                disabled={resolving}
                className="flex-1 px-4 py-2 text-sm border border-input rounded-lg hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.label}
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

      <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-4">
        {/* Back Button */}
        <div className="mb-2 sm:mb-3">
          <BackButton fallbackHref="/wagers" />
        </div>

        {/* Main Card - Compact Mobile Design */}
        <article className="bg-card border border-border/50 rounded-xl sm:rounded-2xl overflow-hidden mb-3 sm:mb-4">
          {/* Header - Tighter on mobile */}
          <header className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 border-b border-border/30">
            {/* Status Row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                {wager.is_system_generated && <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  wager.status === "OPEN" 
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : wager.status === "SETTLED"
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}>
                  {wager.status === "SETTLED" ? "Settled" : wager.status === "RESOLVED" ? "Resolved" : "Live"}
                </span>
              </div>
              {wager.deadline && wager.status === "OPEN" && (
                <div className={`flex items-center gap-1 text-[11px] font-medium ${
                  deadlineStatus === 'red' ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                }`}>
                  <Clock className="h-3 w-3" />
                  <DeadlineDisplay deadline={wager.deadline} size="sm" showLabel={false} className="text-[11px]" />
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold leading-tight">{wager.title}</h1>
            
            {/* Description - collapsible on mobile if long */}
            {wager.description && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1.5 line-clamp-2 sm:line-clamp-none">{wager.description}</p>
            )}
          </header>

          {/* Stats Strip */}
          <div className="px-3 sm:px-5 md:px-6 lg:px-8 py-2 bg-muted/30 flex items-center justify-between text-[11px] sm:text-xs">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Coins className="h-3 w-3 text-amber-500" />
                {formatVolume(totalPot)} pool
              </span>
              <span className="text-muted-foreground">{totalParticipants} {totalParticipants === 1 ? 'bettor' : 'bettors'}</span>
            </div>
            <span className="font-medium">{formatCurrency(wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}/bet</span>
          </div>

          {/* Outcomes Section - Compact on mobile */}
          <div className="px-3 sm:px-5 md:px-6 lg:px-8 py-3 sm:py-4 space-y-2">
            {/* Option A */}
            <button
              onClick={() => canBet && !userEntry && handleJoinClick("a")}
              disabled={!canBet || !!userEntry || wager.status !== "OPEN"}
              className={`w-full flex items-center justify-between px-3 py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all ${
                isSettled && wager.winning_side === "a"
                  ? "bg-emerald-500/15 border-2 border-emerald-500/40 ring-1 ring-emerald-500/20"
                  : userEntry?.side === "a"
                  ? "bg-primary/10 border-2 border-primary/40"
                  : canBet && !userEntry
                  ? "bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/40 active:scale-[0.98]"
                  : "bg-muted/20 border border-border/40"
              } disabled:cursor-default`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isSettled && wager.winning_side === "a" && <Trophy className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                <span className={`font-medium truncate text-sm sm:text-base ${
                  isSettled && wager.winning_side === "a" ? "text-emerald-700 dark:text-emerald-400" :
                  userEntry?.side === "a" ? "text-primary" :
                  "text-emerald-700 dark:text-emerald-400"
                }`}>{wager.side_a}</span>
                {userEntry?.side === "a" && (
                  <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">YOU</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">{formatVolume(sideAPot)}</span>
                <span className={`text-lg sm:text-xl font-bold tabular-nums ${
                  isSettled && wager.winning_side === "a" ? "text-emerald-600 dark:text-emerald-400" :
                  "text-emerald-600 dark:text-emerald-400"
                }`}>{sideAPercent}%</span>
              </div>
            </button>

            {/* Option B */}
            <button
              onClick={() => canBet && !userEntry && handleJoinClick("b")}
              disabled={!canBet || !!userEntry || wager.status !== "OPEN"}
              className={`w-full flex items-center justify-between px-3 py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all ${
                isSettled && wager.winning_side === "b"
                  ? "bg-emerald-500/15 border-2 border-emerald-500/40 ring-1 ring-emerald-500/20"
                  : userEntry?.side === "b"
                  ? "bg-primary/10 border-2 border-primary/40"
                  : canBet && !userEntry
                  ? "bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/40 active:scale-[0.98]"
                  : "bg-muted/20 border border-border/40"
              } disabled:cursor-default`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isSettled && wager.winning_side === "b" && <Trophy className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                <span className={`font-medium truncate text-sm sm:text-base ${
                  isSettled && wager.winning_side === "b" ? "text-emerald-700 dark:text-emerald-400" :
                  userEntry?.side === "b" ? "text-primary" :
                  "text-rose-700 dark:text-rose-400"
                }`}>{wager.side_b}</span>
                {userEntry?.side === "b" && (
                  <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">YOU</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">{formatVolume(sideBPot)}</span>
                <span className={`text-lg sm:text-xl font-bold tabular-nums ${
                  isSettled && wager.winning_side === "b" ? "text-emerald-600 dark:text-emerald-400" :
                  "text-rose-600 dark:text-rose-400"
                }`}>{sideBPercent}%</span>
              </div>
            </button>

            {/* Status Messages */}
            {wager.status === "OPEN" && isWithinCutoff && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium py-1">⚡ Betting closes in &lt;20s</p>
            )}
            {isSettled && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 text-center py-1">
                ✓ {totalParticipants === 0 ? "Resolved with no participants" : "Winnings distributed"}
              </p>
            )}
          </div>

          {/* User Position Card - Shows when user has entry */}
          {userEntry && wager.status === "OPEN" && !isDeadlineElapsed(wager.deadline) && (
            <div className="mx-3 sm:mx-5 md:mx-6 lg:mx-8 mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Your position</p>
                  <p className="text-sm font-semibold truncate">
                    {userEntry.side === "a" ? wager.side_a : wager.side_b}
                    <span className="text-muted-foreground font-normal ml-1.5">
                      • {formatCurrency(userEntry.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}
                    </span>
                  </p>
                  {totalPot > 0 && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Potential: {formatReturnMultiplier(userEntry.side === "a" ? returns.sideAReturnMultiplier : returns.sideBReturnMultiplier)} ({formatReturnPercentage(userEntry.side === "a" ? returns.sideAReturnPercentage : returns.sideBReturnPercentage)})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!isCreator && !isWithinCutoff && (
                    <button
                      onClick={() => setShowUnjoinDialog(true)}
                      disabled={unjoining}
                      className="px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-border hover:bg-muted transition disabled:opacity-50"
                    >
                      {unjoining ? <Loader2 className="h-3 w-3 animate-spin" /> : "Leave"}
                    </button>
                  )}
                  {!isWithinCutoff && (
                    <button
                      onClick={() => {
                        setNewSide(userEntry.side === "a" ? "b" : "a");
                        setShowChangeSideDialog(true);
                      }}
                      disabled={changingSide}
                      className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      {changingSide ? <Loader2 className="h-3 w-3 animate-spin" /> : "Switch"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Bar - Compact */}
          <footer className="px-3 sm:px-5 md:px-6 lg:px-8 py-2 bg-muted/20 border-t border-border/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <div className="flex items-center">
                <SocialShareButtons
                  url={`/wager/${wager.short_id || wager.id}`}
                  title={wager.title}
                  description={`${wager.side_a} vs ${wager.side_b}`}
                  wagerId={wager.id}
                />
              </div>
              {user && isCreator && !isDeadlineElapsed(wager.deadline) && (
                <button onClick={() => setShowInviteDialog(true)} className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-[11px] sm:text-xs font-medium transition">
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Invite</span>
                </button>
              )}
            </div>
            {isCreator && (
              <div className="flex items-center gap-1">
                {wager.status === "OPEN" && user && entries.filter(e => String(e.user_id).trim() !== String(user.id).trim()).length === 0 && !isDeadlineElapsed(wager.deadline) && (
                  <>
                    <button onClick={handleEdit} disabled={editing} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 transition">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive disabled:opacity-50 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {canCreatorResolve && (
                  <button onClick={handleResolve} disabled={resolving} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 text-[11px] sm:text-xs font-medium disabled:opacity-50 transition">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Resolve</span>
                  </button>
                )}
              </div>
            )}
          </footer>
        </article>


        {/* Tabs - Compact with visible labels */}
        <div className="bg-card border border-border/50 rounded-xl sm:rounded-2xl overflow-hidden">
          <nav className="flex border-b border-border/30">
            {[
              { key: "comments", icon: MessageSquare, label: "Chat", fullLabel: "Comments" },
              { key: "participants", icon: Users, label: "Bets", fullLabel: "Participants", count: totalParticipants },
              { key: "activities", icon: Activity, label: "Log", fullLabel: "Activity" },
            ].map(({ key, icon: Icon, label, fullLabel, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 py-2.5 text-[11px] sm:text-xs font-medium transition relative ${
                  activeTab === key 
                    ? "text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="sm:hidden">{label}</span>
                <span className="hidden sm:inline">{fullLabel}</span>
                {count !== undefined && count > 0 && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-muted/80 tabular-nums">{count}</span>
                )}
                {activeTab === key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground rounded-full" />
                )}
              </button>
            ))}
          </nav>
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">
            {activeTab === "comments" && <WagerComments wagerId={wager.id} />}
            {activeTab === "participants" && (
              <WagerParticipants
                entries={entries}
                userNames={userNames}
                wager={{ creator_id: wager.creator_id || undefined, status: wager.status, winning_side: wager.winning_side, side_a: wager.side_a, side_b: wager.side_b, currency: wager.currency }}
              />
            )}
            {activeTab === "activities" && <WagerActivities wagerId={wager.id} sideA={wager.side_a} sideB={wager.side_b} />}
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
          isCreator={!!isCreator}
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
