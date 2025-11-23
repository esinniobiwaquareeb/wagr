"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { Home, Plus, Wallet, Trophy, User, Settings, Bell, History, LogOut, Menu, X, Search, ChevronDown, CirclePlus } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { useToast } from "@/hooks/use-toast";
import { clear2FAVerification } from "@/lib/session-2fa";
import { getCurrentUser, type AuthUser } from "@/lib/auth/client";
import { WAGER_CATEGORIES } from "@/lib/constants";
import { wagersApi } from "@/lib/api-client";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { DepositModal } from "@/components/deposit-modal";
import { CreateWagerModal } from "@/components/create-wager-modal";
import { HowItWorksModal } from "@/components/how-it-works-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const supabase = createClient();
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;

  // Sync search query with URL params
  useEffect(() => {
    if (pathname === '/wagers') {
      const urlSearch = searchParams?.get('search') || '';
      setSearchQuery(urlSearch);
    }
  }, [searchParams, pathname]);

  const categoryCountsFetchingRef = useRef(false);
  const categoryCountsDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch category counts
  useEffect(() => {
    const fetchCategoryCounts = async () => {
      // Prevent concurrent fetches
      if (categoryCountsFetchingRef.current) return;
      categoryCountsFetchingRef.current = true;

      try {
        const response = await wagersApi.list({ limit: 200 });
        const wagersData = response?.wagers || (Array.isArray(response) ? response : []);
        
        // Calculate counts for each category (only OPEN wagers)
        const counts: Record<string, number> = {};
        WAGER_CATEGORIES.forEach(category => {
          counts[category.id] = wagersData.filter((wager: any) => 
            wager.category === category.id && wager.status === "OPEN"
          ).length;
        });
        
        setCategoryCounts(counts);
      } catch (error) {
        // Silent fail - counts are not critical
        console.error('Error fetching category counts:', error);
      } finally {
        categoryCountsFetchingRef.current = false;
      }
    };

    fetchCategoryCounts();

    // Set up real-time subscription for wager changes
    const wagersChannel = supabase
      .channel("topnav-wagers-counts")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "wagers",
          filter: "is_public=eq.true"
        },
        () => {
          // Debounce refetch to avoid too many calls
          if (categoryCountsDebounceRef.current) {
            clearTimeout(categoryCountsDebounceRef.current);
          }
          categoryCountsDebounceRef.current = setTimeout(() => {
            fetchCategoryCounts();
          }, 2000); // Increased debounce to 2 seconds
        }
      )
      .subscribe();

    // Refresh counts periodically as fallback - increased to 2 minutes
    const interval = setInterval(fetchCategoryCounts, 120000); // Every 2 minutes

    return () => {
      wagersChannel.unsubscribe();
      clearInterval(interval);
      if (categoryCountsDebounceRef.current) {
        clearTimeout(categoryCountsDebounceRef.current);
      }
    };
  }, [supabase]);

  const walletBalanceFetchingRef = useRef(false);
  const walletBalanceDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!user) {
        setWalletBalance(null);
        return;
      }

      // Prevent concurrent fetches
      if (walletBalanceFetchingRef.current) return;
      walletBalanceFetchingRef.current = true;

      try {
        const { walletApi } = await import('@/lib/api-client');
        const response = await walletApi.getBalance();
        setWalletBalance(response.balance);
      } catch (error) {
        // Silent fail - balance is not critical
        console.error('Error fetching wallet balance:', error);
      } finally {
        walletBalanceFetchingRef.current = false;
      }
    };

    if (user) {
      fetchWalletBalance();
      
      // Refresh balance periodically - increased to 2 minutes
      const interval = setInterval(fetchWalletBalance, 120000); // Every 2 minutes
      
      // Listen for wallet updates
      const walletChannel = supabase
        .channel("topnav-wallet-balance")
        .on(
          "postgres_changes",
          { 
            event: "*", 
            schema: "public", 
            table: "profiles",
            filter: `id=eq.${user.id}`
          },
          () => {
            // Debounce wallet balance updates
            if (walletBalanceDebounceRef.current) {
              clearTimeout(walletBalanceDebounceRef.current);
            }
            walletBalanceDebounceRef.current = setTimeout(() => {
              fetchWalletBalance();
            }, 2000); // Increased debounce to 2 seconds
          }
        )
        .subscribe();

      return () => {
        clearInterval(interval);
        walletChannel.unsubscribe();
        if (walletBalanceDebounceRef.current) {
          clearTimeout(walletBalanceDebounceRef.current);
        }
      };
    }
  }, [user, supabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error getting user:', error);
        setUser(null);
      }
    };
    
    getUser();

    const handleAuthStateChanged = async () => {
      // Immediately fetch user without delay for faster UI update
      await getUser();
      // Force a re-render by refreshing router state
      router.refresh();
    };
    window.addEventListener('auth-state-changed', handleAuthStateChanged);

    // Reduced polling frequency - check every 5 minutes instead of 1 minute
    const interval = setInterval(() => {
      getUser();
    }, 300000); // Every 5 minutes

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
      clearInterval(interval);
    };
  }, [router]);

  const fetchingProfileRef = useRef(false);
  const debounceProfileTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

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
      // Silent fail
    } finally {
      fetchingProfileRef.current = false;
    }
  }, [user, supabase]);

  const debouncedRefetchProfile = useCallback(() => {
    if (debounceProfileTimeoutRef.current) {
      clearTimeout(debounceProfileTimeoutRef.current);
    }
    debounceProfileTimeoutRef.current = setTimeout(() => {
      fetchProfile();
    }, 2000); // Increased debounce to 2 seconds
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();

    if (user) {
      const channel = supabase
        .channel(`topnav-profile:${user.id}`)
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
  }, [user, supabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleProfileUpdate = () => {
      debouncedRefetchProfile();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);

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

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

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
      // Silent fail
    } finally {
      fetchingNotificationsRef.current = false;
    }
  }, [user, supabase]);

  const debouncedRefetchNotifications = useCallback(() => {
    if (debounceNotificationsTimeoutRef.current) {
      clearTimeout(debounceNotificationsTimeoutRef.current);
    }
    debounceNotificationsTimeoutRef.current = setTimeout(() => {
      fetchUnreadCount();
    }, 1000);
  }, [fetchUnreadCount]);

  useEffect(() => {
    fetchUnreadCount();

    if (user) {
      const channel = supabase
        .channel(`topnav-notifications:${user.id}`)
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
  }, [user, supabase]);

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
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      setUser(null);
      setProfile(null);
      
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    } else {
      params.delete('search');
    }
    router.push(`/wagers?${params.toString()}`, { scroll: false });
  };

  const isActive = (path: string) => pathname === path;

  // Get border color based on wallet balance
  const getWalletBorderColor = (balance: number | null): string => {
    if (balance === null) return 'border-border';
    
    // Thresholds: Low < 1000, Medium 1000-10000, High > 10000
    if (balance < 1000) {
      return 'border-red-500/50 dark:border-red-400/50'; // Low balance - red
    } else if (balance < 10000) {
      return 'border-yellow-500/50 dark:border-yellow-400/50'; // Medium balance - yellow
    } else {
      return 'border-green-500/50 dark:border-green-400/50'; // High balance - green
    }
  };

  return (
    <>
      {/* Top Navigation Bar - Large Screens */}
      <nav className="hidden lg:block sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {/* Main Top Bar */}
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <Link 
              href="/wagers" 
              className="flex items-center gap-2.5 flex-shrink-0 group"
            >
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
                <span className="text-primary-foreground font-bold text-xl">W</span>
              </div>
              <span className="text-xl font-bold tracking-tight">wagr</span>
            </Link>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search wagers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 h-10 bg-muted/50 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                />
              </div>
            </form>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {user ? (
                <>
                  {/* Wallet Balance - Clean Button Style */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDepositModal(true)}
                    className={`h-9 px-3 gap-2 font-medium hover:bg-muted/80 hover:text-foreground transition-colors group border-2 ${getWalletBorderColor(walletBalance)}`}
                  >
                    <Wallet className="h-4 w-4" />
                    <span className="hidden xl:inline whitespace-nowrap">
                      {walletBalance !== null ? formatCurrency(walletBalance, currency) : '...'}
                    </span>
                    <span className="xl:hidden text-xs">
                      {walletBalance !== null ? formatCurrency(walletBalance, currency) : '...'}
                    </span>
                    <CirclePlus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Button>

                  {/* Create Button */}
                  <Button 
                    size="sm" 
                    className="h-9 px-4 gap-2 font-medium"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden xl:inline">Create</span>
                  </Button>

                  {/* Notifications */}
                  {user && (
                    <NotificationsDropdown
                      userId={user.id}
                      unreadCount={unreadCount}
                      onUnreadCountChange={setUnreadCount}
                    />
                  )}

                  {/* User Menu */}
                  <DropdownMenu open={showUserMenu} onOpenChange={setShowUserMenu}>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-9 px-2 gap-2 hover:bg-muted/80 hover:text-foreground transition-colors group"
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/50 group-hover:border-primary/50 group-hover:bg-primary/20 transition-all">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={profile.username || "User"}
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                          )}
                        </div>
                        <span className="hidden xl:inline text-sm font-medium max-w-[120px] truncate">
                          {profile?.username || user.email?.split('@')[0] || "User"}
                        </span>
                        <ChevronDown 
                          className={`h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-all hidden xl:block ${
                            showUserMenu ? 'rotate-180' : ''
                          }`} 
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{profile?.username || "User"}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/wagers" className="flex items-center gap-2 cursor-pointer">
                          <Home className="h-4 w-4" />
                          <span>Wagers</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/leaderboard" className="flex items-center gap-2 cursor-pointer">
                          <Trophy className="h-4 w-4" />
                          <span>Leaderboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/wallet" className="flex items-center gap-2 cursor-pointer">
                          <Wallet className="h-4 w-4" />
                          <span>Wallet</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/history" className="flex items-center gap-2 cursor-pointer">
                          <History className="h-4 w-4" />
                          <span>History</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                          <User className="h-4 w-4" />
                          <span>Profile</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/preferences" className="flex items-center gap-2 cursor-pointer">
                          <Settings className="h-4 w-4" />
                          <span>Preferences</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowLogoutDialog(true)}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowHowItWorksModal(true)}
                    className="h-9 px-4 font-medium"
                  >
                    How it works
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowAuthModal(true)}
                    className="h-9 px-4 font-medium"
                  >
                    Log In
                  </Button>
                  <Button 
                    onClick={() => setShowAuthModal(true)}
                    className="h-9 px-4 font-medium"
                  >
                    Sign Up
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Secondary Navigation - Category Links */}
          <div className="flex items-center gap-0.5 h-12 border-t border-border/50 overflow-x-auto scrollbar-hide">
            <Link
              href="/wagers"
              onClick={(e) => {
                e.preventDefault();
                const params = new URLSearchParams(searchParams?.toString() || '');
                params.delete('category');
                router.push(`/wagers?${params.toString()}`, { scroll: false });
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap text-sm font-medium transition-colors ${
                pathname === "/wagers" && !searchParams?.get("category")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Home className="h-4 w-4" />
              <span>All</span>
            </Link>
            {WAGER_CATEGORIES.map((category) => {
              const count = categoryCounts[category.id] || 0;
              return (
                <Link
                  key={category.id}
                  href={`/wagers?category=${category.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const params = new URLSearchParams(searchParams?.toString() || '');
                    params.set('category', category.id);
                    router.push(`/wagers?${params.toString()}`, { scroll: false });
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap text-sm font-medium transition-colors ${
                    pathname === "/wagers" && searchParams?.get("category") === category.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                  {count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                      pathname === "/wagers" && searchParams?.get("category") === category.id
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/wagers" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-primary-foreground font-bold text-base">W</span>
            </div>
            <span className="text-base font-bold tracking-tight">wagr</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="h-9 w-9"
            >
              {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="border-t border-border/50 bg-background">
            <div className="px-3 py-3 space-y-1">
              {user ? (
                <>
                  {/* Wallet Balance - Mobile */}
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowDepositModal(true);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-2 ${getWalletBorderColor(walletBalance)} ${
                      isActive("/wallet")
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50 text-foreground hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      <span>Wallet Balance</span>
                    </div>
                    <span className="font-semibold">
                      {walletBalance !== null ? formatCurrency(walletBalance, currency) : '...'}
                    </span>
                  </button>
                  
                  <Link
                    href="/wagers"
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive("/wagers")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Home className="h-5 w-5 flex-shrink-0" />
                    <span>Wagers</span>
                  </Link>
                  <Link
                    href="/leaderboard"
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive("/leaderboard")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Trophy className="h-5 w-5 flex-shrink-0" />
                    <span>Leaderboard</span>
                  </Link>
                  <Link
                    href="/notifications"
                    onClick={() => setShowMobileMenu(false)}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive("/notifications")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Bell className="h-5 w-5 flex-shrink-0" />
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px]">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/wallet"
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive("/wallet")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Wallet className="h-5 w-5 flex-shrink-0" />
                    <span>Wallet</span>
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive("/profile")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <User className="h-5 w-5 flex-shrink-0" />
                    <span>Profile</span>
                  </Link>
                  <Link
                    href="/preferences"
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive("/preferences")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Settings className="h-5 w-5 flex-shrink-0" />
                    <span>Preferences</span>
                  </Link>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowCreateModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
                  >
                    <Plus className="h-5 w-5 flex-shrink-0" />
                    <span>Create Wager</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowLogoutDialog(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm font-medium transition-colors"
                  >
                    <LogOut className="h-5 w-5 flex-shrink-0" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowHowItWorksModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 text-sm font-medium transition-colors"
                  >
                    How it works
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowAuthModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 text-sm font-medium transition-colors"
                  >
                    <User className="h-5 w-5 flex-shrink-0" />
                    <span>Login</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

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
      <HowItWorksModal
        isOpen={showHowItWorksModal}
        onClose={() => setShowHowItWorksModal(false)}
      />
      {user && (
        <>
          <DepositModal
            open={showDepositModal}
            onOpenChange={setShowDepositModal}
            onSuccess={() => {
              // Refresh balance after successful deposit
              if (user) {
                const fetchBalance = async () => {
                  try {
                    const { walletApi } = await import('@/lib/api-client');
                    const response = await walletApi.getBalance();
                    setWalletBalance(response.balance);
                  } catch (error) {
                    console.error('Error refreshing balance:', error);
                  }
                };
                fetchBalance();
              }
            }}
          />
          <CreateWagerModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
            onSuccess={() => {
              // Refresh category counts and navigate to wagers page
              const fetchCategoryCounts = async () => {
                try {
                  const response = await wagersApi.list({ limit: 200 });
                  const wagersData = response?.wagers || (Array.isArray(response) ? response : []);
                  const counts: Record<string, number> = {};
                  WAGER_CATEGORIES.forEach(category => {
                    counts[category.id] = wagersData.filter((wager: any) => 
                      wager.category === category.id && wager.status === "OPEN"
                    ).length;
                  });
                  setCategoryCounts(counts);
                } catch (error) {
                  console.error('Error fetching category counts:', error);
                }
              };
              fetchCategoryCounts();
              router.push('/wagers');
            }}
          />
        </>
      )}
    </>
  );
}
