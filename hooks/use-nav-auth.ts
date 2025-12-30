"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from 'next/navigation';
import { getCurrentUser, type AuthUser, logout as clientLogout } from "@/lib/auth/client";
import { clear2FAVerification } from "@/lib/session-2fa";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

export interface NavProfile {
  username: string | null;
  avatar_url: string | null;
}

export interface UseNavAuthResult {
  user: AuthUser | null;
  profile: NavProfile | null;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  handleLogout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

/**
 * Shared hook for navigation components (TopNav, MobileNav)
 * Handles auth state, profile, notifications, and logout
 */
export function useNavAuth(): UseNavAuthResult {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<NavProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs to prevent concurrent fetches
  const fetchingUserRef = useRef(false);
  const userRef = useRef<AuthUser | null>(null);
  const fetchingProfileRef = useRef(false);
  const fetchingNotificationsRef = useRef(false);
  const debounceProfileTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceNotificationsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Fetch user
  const fetchUser = useCallback(async (forceRefresh = false) => {
    if (fetchingUserRef.current && !forceRefresh) return;
    fetchingUserRef.current = true;

    try {
      const currentUser = await getCurrentUser(forceRefresh);
      setUser(currentUser);
      userRef.current = currentUser;

      if (!currentUser) {
        setProfile(null);
        setUnreadCount(0);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Unauthorized') && !errorMessage.includes('Forbidden')) {
        logger.error('Error getting user', error);
      }
      setUser(null);
      userRef.current = null;
      setProfile(null);
      setUnreadCount(0);
    } finally {
      fetchingUserRef.current = false;
    }
  }, []);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!userRef.current) {
      setProfile(null);
      return;
    }

    if (fetchingProfileRef.current) return;
    fetchingProfileRef.current = true;

    try {
      const { profileApi } = await import('@/lib/api-client');
      const profileData = await profileApi.get();
      const data = profileData?.profile || null;

      if (data) {
        setProfile({
          username: data.username,
          avatar_url: data.avatar_url,
        });
      }
    } catch (error) {
      // Silent fail
    } finally {
      fetchingProfileRef.current = false;
    }
  }, []);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!userRef.current) {
      setUnreadCount(0);
      return;
    }

    if (fetchingNotificationsRef.current) return;
    fetchingNotificationsRef.current = true;

    try {
      const { notificationsApi } = await import('@/lib/api-client');
      const response = await notificationsApi.list({ limit: 1, read: 'false' });
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      // Silent fail
    } finally {
      fetchingNotificationsRef.current = false;
    }
  }, []);

  // Debounced refetch functions
  const debouncedRefetchProfile = useCallback(() => {
    if (debounceProfileTimeoutRef.current) {
      clearTimeout(debounceProfileTimeoutRef.current);
    }
    debounceProfileTimeoutRef.current = setTimeout(() => {
      fetchProfile();
    }, 2000);
  }, [fetchProfile]);

  const debouncedRefetchNotifications = useCallback(() => {
    if (debounceNotificationsTimeoutRef.current) {
      clearTimeout(debounceNotificationsTimeoutRef.current);
    }
    debounceNotificationsTimeoutRef.current = setTimeout(() => {
      fetchUnreadCount();
    }, 1000);
  }, [fetchUnreadCount]);

  // Initial fetch and auth state listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    fetchUser();

    const handleAuthStateChanged = async () => {
      await fetchUser(true);
      setTimeout(async () => {
        await fetchUser(true);
      }, 300);
    };

    window.addEventListener('auth-state-changed', handleAuthStateChanged);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
    };
  }, [fetchUser]);

  // Profile fetch and listeners
  useEffect(() => {
    if (user) {
      // Set initial profile from user data
      setProfile({
        username: user.username,
        avatar_url: null,
      });
      fetchProfile();
    }

    const handleProfileUpdate = () => {
      debouncedRefetchProfile();
    };
    window.addEventListener('profile-updated', handleProfileUpdate);
    window.addEventListener('balance-updated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
      window.removeEventListener('balance-updated', handleProfileUpdate);
      if (debounceProfileTimeoutRef.current) {
        clearTimeout(debounceProfileTimeoutRef.current);
      }
    };
  }, [user, fetchProfile, debouncedRefetchProfile]);

  // Notification fetch and listeners
  useEffect(() => {
    fetchUnreadCount();

    const handleNotificationUpdate = () => {
      debouncedRefetchNotifications();
    };
    window.addEventListener('notifications-updated', handleNotificationUpdate);
    window.addEventListener('notification-updated', handleNotificationUpdate);

    return () => {
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
      window.removeEventListener('notification-updated', handleNotificationUpdate);
      if (debounceNotificationsTimeoutRef.current) {
        clearTimeout(debounceNotificationsTimeoutRef.current);
      }
    };
  }, [user, fetchUnreadCount, debouncedRefetchNotifications]);

  // Logout handler
  const handleLogout = useCallback(async () => {
    try {
      clear2FAVerification();

      // Clear local state immediately
      setUser(null);
      userRef.current = null;
      setProfile(null);
      setUnreadCount(0);

      await clientLogout();
      router.refresh();

      toast({
        title: "You're signed out",
        description: "Come back soon!",
      });

      setTimeout(() => {
        router.push("/wagers?login=true");
      }, 100);
    } catch (error) {
      // Even on error, clear local state
      setUser(null);
      userRef.current = null;
      setProfile(null);
      setUnreadCount(0);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-state-changed'));
      }

      router.refresh();

      toast({
        title: "You're signed out",
        description: "Come back soon!",
      });

      setTimeout(() => {
        router.push("/wagers?login=true");
      }, 100);
    }
  }, [router, toast]);

  return {
    user,
    profile,
    unreadCount,
    setUnreadCount,
    handleLogout,
    refreshUser: fetchUser,
  };
}

