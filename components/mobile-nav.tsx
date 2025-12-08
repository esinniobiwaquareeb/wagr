"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from "react";
import { Home, Plus, Wallet, Trophy, User, Settings, Bell, History, LogOut, Activity, BookOpen } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CreateWagerModal } from "@/components/create-wager-modal";
import { useToast } from "@/hooks/use-toast";
import { clear2FAVerification } from "@/lib/session-2fa";
import { getCurrentUser, type AuthUser } from "@/lib/auth/client";

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const getUser = async (forceRefresh = false) => {
      try {
        // Use custom auth API
        const currentUser = await getCurrentUser(forceRefresh);
        setUser(currentUser);
        // If no user, ensure all dependent state is cleared
        if (!currentUser) {
          setProfile(null);
          setUnreadCount(0);
        }
      } catch (error) {
        console.error('Error getting user:', error);
        setUser(null);
        setProfile(null);
        setUnreadCount(0);
      }
    };
    
    getUser();

    // Listen to custom auth state change events (triggered after login/logout)
    const handleAuthStateChanged = async () => {
      // Force refresh to bypass cache after logout
      await getUser(true);
    };
    window.addEventListener('auth-state-changed', handleAuthStateChanged);

    // Poll for auth changes (fallback)
    const interval = setInterval(() => {
      getUser();
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
      clearInterval(interval);
    };
  }, []);

  const fetchingProfileRef = useRef(false);
  const debounceProfileTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user profile
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    // Prevent concurrent fetches
    if (fetchingProfileRef.current) return;
    fetchingProfileRef.current = true;

    try {
      const { profileApi } = await import('@/lib/api-client');
      const profileData = await profileApi.get();
      if (profileData?.profile) {
        setProfile({
          username: profileData.profile.username,
          avatar_url: profileData.profile.avatar_url,
        });
      }
    } catch (error) {
      // Silent fail for nav
    } finally {
      fetchingProfileRef.current = false;
    }
  }, [user]);

  // Debounced refetch function for subscriptions
  const debouncedRefetchProfile = useCallback(() => {
    if (debounceProfileTimeoutRef.current) {
      clearTimeout(debounceProfileTimeoutRef.current);
    }
    debounceProfileTimeoutRef.current = setTimeout(() => {
      fetchProfile();
    }, 1000); // Debounce by 1 second
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();

    // Poll for profile updates every 2 minutes
    const interval = setInterval(() => {
      if (user) {
        debouncedRefetchProfile();
      }
    }, 120000);

    return () => {
      clearInterval(interval);
      if (debounceProfileTimeoutRef.current) {
        clearTimeout(debounceProfileTimeoutRef.current);
      }
    };
  }, [user, debouncedRefetchProfile]);

  // Listen for custom profile update events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleProfileUpdate = () => {
      debouncedRefetchProfile();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []); // Empty deps - only set up listener once

  // Set profile from user data if available
  useEffect(() => {
    if (user) {
      setProfile({
        username: user.username,
        avatar_url: null,
      });
    }
  }, [user]);

  const fetchingNotificationsRef = useRef(false);
  const debounceNotificationsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Prevent concurrent fetches
    if (fetchingNotificationsRef.current) return;
    fetchingNotificationsRef.current = true;

    try {
      const { notificationsApi } = await import('@/lib/api-client');
      const response = await notificationsApi.list({ limit: 1, read: 'false' });
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      // Silent fail for nav
    } finally {
      fetchingNotificationsRef.current = false;
    }
  }, [user]);

  // Debounced refetch function for notifications
  const debouncedRefetchNotifications = useCallback(() => {
    if (debounceNotificationsTimeoutRef.current) {
      clearTimeout(debounceNotificationsTimeoutRef.current);
    }
    debounceNotificationsTimeoutRef.current = setTimeout(() => {
      fetchUnreadCount();
    }, 1000); // Debounce by 1 second
  }, [fetchUnreadCount]);

  useEffect(() => {
    fetchUnreadCount();

    // Poll for notification updates every 30 seconds
    const interval = setInterval(() => {
      if (user) {
        debouncedRefetchNotifications();
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      if (debounceNotificationsTimeoutRef.current) {
        clearTimeout(debounceNotificationsTimeoutRef.current);
      }
    };
  }, [user, debouncedRefetchNotifications]);

  // Listen for custom notification update events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleNotificationUpdate = () => {
      fetchUnreadCount();
    };

    window.addEventListener('notifications-updated', handleNotificationUpdate);

    return () => {
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
    };
  }, [fetchUnreadCount]);

  const handleLogout = async () => {
    try {
      clear2FAVerification();
      
      // Import logout function that properly clears cache
      const { logout: clientLogout } = await import('@/lib/auth/client');
      await clientLogout();

      // Immediately clear all local state
      setUser(null);
      setProfile(null);
      setUnreadCount(0);
      
      // Dispatch auth state change event immediately
      window.dispatchEvent(new Event('auth-state-changed'));
      
      // Force refresh router to clear server-side state
      router.refresh();
      
      toast({
        title: "You're signed out",
        description: "Come back soon!",
      });
      
      // Navigate after a brief delay to ensure state is cleared
      setTimeout(() => {
        router.push("/wagers?login=true");
      }, 100);
    } catch (error) {
      console.error("Error logging out:", error);
      
      // Even on error, clear local state
      setUser(null);
      setProfile(null);
      setUnreadCount(0);
      window.dispatchEvent(new Event('auth-state-changed'));
      router.refresh();
      
      toast({
        title: "You're signed out",
        description: "Come back soon!",
      });
      
      setTimeout(() => {
        router.push("/wagers?login=true");
      }, 100);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Mobile Navigation - Bottom Bar */}
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border lg:hidden z-50 safe-area-inset-bottom shadow-lg">
      <div className="flex justify-around items-center h-20 px-1">
        <Link
          href="/wagers"
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            isActive("/wagers")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Wagers"
        >
          <Home className={`h-5 w-5 transition-transform mb-0.5 ${isActive("/wagers") ? "scale-110" : ""}`} />
          <span className="text-[9px] font-medium leading-tight text-center">Wagers</span>
        </Link>
        
        <Link
          href="/leaderboard"
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            isActive("/leaderboard")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Leaderboard"
        >
          <Trophy className={`h-5 w-5 transition-transform mb-0.5 ${isActive("/leaderboard") ? "scale-110" : ""}`} />
          <span className="text-[9px] font-medium leading-tight text-center">Top</span>
        </Link>

        {/* Floating Create Button */}
        <button
          onClick={() => {
            if (user) {
              setShowCreateModal(true);
            } else {
              setShowAuthModal(true);
            }
          }}
          className="relative flex items-center justify-center w-14 h-14 -mt-4 rounded-full shadow-lg transition-all duration-300 active:scale-95 touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[56px] bg-primary text-primary-foreground hover:shadow-xl hover:scale-105"
          title={user ? "Create Wager" : "Login to Create Wager"}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>

        <Link
          href="/wallet"
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            isActive("/wallet")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Wallet"
        >
          <Wallet className={`h-5 w-5 transition-transform mb-0.5 ${isActive("/wallet") ? "scale-110" : ""}`} />
          <span className="text-[9px] font-medium leading-tight text-center">Wallet</span>
        </Link>

        {user ? (
          <Link
            href="/profile"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isActive("/profile")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Profile"
          >
            <User className={`h-5 w-5 transition-transform mb-0.5 ${isActive("/profile") ? "scale-110" : ""}`} />
            <span className="text-[9px] font-medium leading-tight text-center">Profile</span>
          </Link>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50"
            title="Login"
          >
            <User className="h-5 w-5 mb-0.5" />
            <span className="text-[9px] font-medium leading-tight text-center">Login</span>
          </button>
        )}
      </div>
      </nav>

      {/* Floating Notification Button - Mobile Only */}
      {user && (
        <Link
          href="/notifications"
          className={`fixed bottom-20 right-4 lg:hidden z-40 w-12 h-12 rounded-full shadow-lg transition-all duration-300 active:scale-95 touch-manipulation flex items-center justify-center ${
            isActive("/notifications")
              ? "bg-primary text-primary-foreground shadow-primary/50"
              : "bg-card border-2 border-border text-foreground hover:border-primary hover:shadow-xl"
          }`}
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px] leading-none border-2 border-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      )}


      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="Logout"
        description="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="default"
        onConfirm={handleLogout}
      />
      <CreateWagerModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          router.push('/wagers');
        }}
      />
    </>
  );
}
