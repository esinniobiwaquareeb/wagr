"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from "react";
import { Home, Plus, Wallet, Trophy, User, Settings, Bell, History, LogOut } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const getUser = async () => {
      try {
        // Use custom auth API
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error getting user:', error);
        setUser(null);
      }
    };
    
    getUser();

    // Listen to custom auth state change events (triggered after login/logout)
    const handleAuthStateChanged = async () => {
      // Small delay to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 50));
      getUser();
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
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        return;
      }

      setProfile(data);
    } catch (error) {
      // Silent fail for nav
    } finally {
      fetchingProfileRef.current = false;
    }
  }, [user, supabase]);

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

    // Subscribe to real-time profile updates
    if (user) {
      const channel = supabase
        .channel(`nav-profile:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          () => {
            debouncedRefetchProfile();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
        if (debounceProfileTimeoutRef.current) {
          clearTimeout(debounceProfileTimeoutRef.current);
        }
      };
    }
  }, [user, supabase]); // Removed fetchProfile and debouncedRefetchProfile from dependencies

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
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      // Silent fail for nav
    } finally {
      fetchingNotificationsRef.current = false;
    }
  }, [user, supabase]);

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

    // Subscribe to real-time updates
    if (user) {
      const channel = supabase
        .channel(`nav-notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            debouncedRefetchNotifications();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
        if (debounceNotificationsTimeoutRef.current) {
          clearTimeout(debounceNotificationsTimeoutRef.current);
        }
      };
    }
  }, [user, supabase]); // Removed fetchUnreadCount and debouncedRefetchNotifications from dependencies

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
      
      // Call logout API
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      setUser(null);
      setProfile(null);
      
      // Trigger auth state change
      window.dispatchEvent(new Event('auth-state-changed'));
      
      toast({
        title: "You're signed out",
        description: "Come back soon!",
      });
      router.push("/wagers?login=true");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Couldn't sign you out",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Mobile Navigation */}
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border md:hidden z-50 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-20 px-1">
        <Link
          href="/wagers"
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 ${
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
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 ${
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
        <Link
          href="/create"
          className={`relative flex items-center justify-center w-12 h-12 -mt-4 rounded-full shadow-lg transition-all duration-300 active:scale-95 touch-manipulation ${
            isActive("/create")
              ? "bg-primary text-primary-foreground shadow-primary/50"
              : "bg-primary text-primary-foreground hover:shadow-xl hover:scale-105"
          }`}
          title="Create Wager"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
          {isActive("/create") && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-foreground" />
          )}
        </Link>

        <Link
          href="/wallet"
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 ${
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
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 ${
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
            className="flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 min-w-0"
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
          className={`fixed bottom-20 right-4 md:hidden z-40 w-12 h-12 rounded-full shadow-lg transition-all duration-300 active:scale-95 touch-manipulation flex items-center justify-center ${
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

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-64 md:border-r md:border-border md:bg-card md:sticky md:top-0 md:h-screen md:overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Main Navigation Links */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <Link
              href="/wagers"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
                isActive("/wagers")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-sm font-medium">Wagers</span>
            </Link>
            <Link
              href="/leaderboard"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
                isActive("/leaderboard")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Trophy className="h-5 w-5" />
              <span className="text-sm font-medium">Leaderboard</span>
            </Link>
            {user && (
              <Link
                href="/notifications"
                className={`relative flex items-center gap-3 py-2 px-3 rounded-lg transition ${
                  isActive("/notifications")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Bell className="h-5 w-5" />
                <span className="text-sm font-medium">Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Link
              href="/wallet"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
                isActive("/wallet")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Wallet className="h-5 w-5" />
              <span className="text-sm font-medium">Wallet</span>
            </Link>
            {user && (
              <Link
                href="/history"
                className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
                  isActive("/history")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <History className="h-5 w-5" />
                <span className="text-sm font-medium">History</span>
              </Link>
            )}
            <Link
              href="/preferences"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
                isActive("/preferences")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Settings className="h-5 w-5" />
              <span className="text-sm font-medium">Preferences</span>
            </Link>
          </div>

          {/* Bottom Section - Profile & Logout */}
          <div className="border-t border-border p-4 space-y-2">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
                    isActive("/profile")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username || "User"}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {profile?.username || "User"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => setShowLogoutDialog(true)}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition w-full text-left"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-3 py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition w-full text-left"
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">Login</span>
              </button>
            )}
          </div>
        </div>
      </nav>

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
    </>
  );
}
