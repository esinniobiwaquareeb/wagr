"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { Home, Plus, Wallet, Trophy, User, Settings, Bell, History, LogOut } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { clear2FAVerification } from "@/lib/session-2fa";

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
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
        // First get the session to ensure it's synced
        await supabase.auth.getSession();
        // Then get the user
        const { data } = await supabase.auth.getUser();
        setUser(data?.user || null);
      } catch (error) {
        console.error('Error getting user:', error);
        setUser(null);
      }
    };
    
    getUser();

    // Listen to Supabase auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Update user state immediately when auth state changes
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      // Also fetch fresh user data to ensure consistency
      getUser();
    });

    // Also listen to custom auth state change events (triggered after login)
    const handleAuthStateChanged = async () => {
      // Small delay to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 50));
      getUser();
    };
    window.addEventListener('auth-state-changed', handleAuthStateChanged);

    return () => {
      authListener?.subscription?.unsubscribe?.();
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
    };
  }, [supabase]);

  // Fetch user profile
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error("Error fetching profile:", error);
          return;
        }

        setProfile(data);
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, [user, supabase]);

  // Fetch unread notification count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);

        if (error) throw error;
        setUnreadCount(count || 0);
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    };

    fetchUnreadCount();

    // Subscribe to real-time updates
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
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, supabase]);

  const handleLogout = async () => {
    try {
      clear2FAVerification();
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
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
      <div className="flex justify-around items-center h-16 px-1">
        <Link
          href="/wagers"
          className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
            isActive("/wagers")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Wagers"
        >
          <Home className={`h-6 w-6 transition-transform ${isActive("/wagers") ? "scale-110" : ""}`} />
          <span className="text-[10px] mt-0.5 font-medium">{isActive("/wagers") ? "Wagers" : ""}</span>
        </Link>
        
        <Link
          href="/leaderboard"
          className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
            isActive("/leaderboard")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Leaderboard"
        >
          <Trophy className={`h-6 w-6 transition-transform ${isActive("/leaderboard") ? "scale-110" : ""}`} />
          <span className="text-[10px] mt-0.5 font-medium">{isActive("/leaderboard") ? "Top" : ""}</span>
        </Link>

        {/* Floating Create Button */}
        <Link
          href="/create"
          className={`relative flex items-center justify-center w-14 h-14 -mt-6 rounded-full shadow-lg transition-all duration-300 active:scale-95 touch-manipulation ${
            isActive("/create")
              ? "bg-primary text-primary-foreground shadow-primary/50"
              : "bg-primary text-primary-foreground hover:shadow-xl hover:scale-105"
          }`}
          title="Create Wager"
        >
          <Plus className="h-7 w-7" strokeWidth={2.5} />
          {isActive("/create") && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-foreground" />
          )}
        </Link>

        <Link
          href="/wallet"
          className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
            isActive("/wallet")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Wallet"
        >
          <Wallet className={`h-6 w-6 transition-transform ${isActive("/wallet") ? "scale-110" : ""}`} />
          <span className="text-[10px] mt-0.5 font-medium">{isActive("/wallet") ? "Wallet" : ""}</span>
        </Link>

        {user ? (
          <Link
            href="/profile"
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
              isActive("/profile")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Profile"
          >
            <User className={`h-6 w-6 transition-transform ${isActive("/profile") ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 font-medium">{isActive("/profile") ? "Profile" : ""}</span>
          </Link>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex flex-col items-center justify-center flex-1 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200"
            title="Login"
          >
            <User className="h-6 w-6" />
            <span className="text-[10px] mt-0.5 font-medium">Login</span>
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
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username || user.email?.split("@")[0] || "User"}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {profile?.username || user.email?.split("@")[0] || "User"}
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
