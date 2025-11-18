"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { User, Mail, Calendar, Settings, Edit2, Save, X, ChevronRight, Shield, ShieldCheck, Trophy, Eye, EyeOff, Key, History, LogOut } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { TwoFactorManage } from "@/components/two-factor-manage";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { PushNotificationSettings } from "@/components/push-notification-settings";
import { clear2FAVerification } from "@/lib/session-2fa";

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  balance: number;
  created_at: string;
  two_factor_enabled?: boolean;
}

export default function Profile() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FAManage, setShow2FAManage] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [myWagers, setMyWagers] = useState<any[]>([]);
  const [loadingWagers, setLoadingWagers] = useState(false);
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;

  const getUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      setUser(null);
      setProfile(null);
      router.push("/wagers?login=true");
      router.refresh();
      return;
    }
    setUser(data.user);
  }, [supabase, router]);

  const fetchProfile = useCallback(async (force = false) => {
    if (!user) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cached = cache.get<Profile>(CACHE_KEYS.USER_PROFILE(user.id));
      
      if (cached) {
        setProfile(cached);
        setUsername(cached.username || "");
        setLoading(false);
        
        // Check if cache is stale - refresh in background if needed
        const cacheEntry = cache.memoryCache.get(CACHE_KEYS.USER_PROFILE(user.id));
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.USER_PROFILE / 2;
          
          if (age > staleThreshold) {
            // Refresh in background
            fetchProfile(true).catch(() => {});
          }
        }
        return;
      }
    }

    // No cache or forced refresh - fetch from API
    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("*, two_factor_enabled")
      .eq("id", user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching profile:", error);
      return;
    }

    if (profileData) {
      setProfile(profileData);
      setUsername(profileData.username || "");
      
      // Cache the result
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      cache.set(CACHE_KEYS.USER_PROFILE(user.id), profileData, CACHE_TTL.USER_PROFILE);
    } else {
      // Create profile if it doesn't exist
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ id: user.id, balance: 0, username: user.email?.split("@")[0] || "User" })
        .select()
        .single();
      if (newProfile) {
        setProfile(newProfile);
        setUsername(newProfile.username || "");
        
        // Cache the new profile
        const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
        cache.set(CACHE_KEYS.USER_PROFILE(user.id), newProfile, CACHE_TTL.USER_PROFILE);
      }
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
        router.push("/wagers?login=true");
        router.refresh();
      } else {
        getUser();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, [getUser, supabase, router]);

  const fetchMyWagers = useCallback(async () => {
    if (!user) return;
    
    setLoadingWagers(true);
    try {
      const { data, error } = await supabase
        .from("wagers")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching wagers:", error);
        return;
      }

      if (data) {
        // Get entry counts for each wager
        const wagersWithCounts = await Promise.all(
          data.map(async (wager) => {
            const { count } = await supabase
              .from("wager_entries")
              .select("*", { count: "exact", head: true })
              .eq("wager_id", wager.id);
            
            return {
              ...wager,
              entries_count: count || 0,
            };
          })
        );
        setMyWagers(wagersWithCounts);
      }
    } catch (error) {
      console.error("Error fetching my wagers:", error);
    } finally {
      setLoadingWagers(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchMyWagers();
    }
  }, [user, fetchProfile, fetchMyWagers]);

  // Real-time subscription for profile updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          fetchProfile();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, supabase, fetchProfile]);

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be signed in to update your profile",
        variant: "destructive",
      });
      return;
    }

    const trimmedUsername = username.trim();
    
    if (!trimmedUsername) {
      toast({
        title: "Username needed",
        description: "Pick a username so people know who you are",
        variant: "destructive",
      });
      return;
    }

    if (trimmedUsername.length < 3) {
      toast({
        title: "Username is too short",
        description: "Make it at least 3 characters long",
        variant: "destructive",
      });
      return;
    }

    if (trimmedUsername.length > 30) {
      toast({
        title: "Username is too long",
        description: "Keep it under 30 characters",
        variant: "destructive",
      });
      return;
    }

    // Validate username format (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      toast({
        title: "Username format issue",
        description: "You can only use letters, numbers, and underscores",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmedUsername })
      .eq("id", user.id);

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        toast({
          title: "That username's taken",
          description: "Someone else is using that username. Try a different one.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Couldn't update profile",
          description: error.message || "Something went wrong. Please try again",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Profile updated!",
        description: "Your changes have been saved",
      });
      setEditing(false);
      fetchProfile();
    }
  };

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = async () => {
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

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!user || !profile) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Please log in to view profile</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <ConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="Logout"
        description="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="default"
        onConfirm={confirmLogout}
      />
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-4 md:mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Profile</h1>
            <p className="text-xs md:text-base text-muted-foreground">Manage your account and preferences</p>
          </div>
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition active:scale-[0.95] touch-manipulation"
              title="Logout"
            >
              <LogOut className="h-4 w-4 md:h-5 md:w-5" />
              <span className="text-xs md:text-sm font-medium hidden sm:inline">Logout</span>
            </button>
          )}
        </div>

        <div className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-6">
          {/* Profile Card */}
          <div className="md:col-span-2 space-y-3 md:space-y-6 order-2 md:order-1">
            <div className="bg-card border border-border rounded-lg p-3 md:p-6">
              <div className="flex items-start justify-between gap-2 mb-3 md:mb-6">
                <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 md:h-20 md:w-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 md:h-10 md:w-10 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base md:text-2xl font-bold truncate">
                      {editing ? (
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-2 py-1.5 md:px-3 md:py-2 border border-input rounded-md bg-background text-foreground text-sm md:text-2xl"
                          placeholder="Username"
                          autoFocus
                        />
                      ) : (
                        profile.username || user.email?.split("@")[0] || "User"
                      )}
                    </h2>
                    <p className="text-[9px] md:text-sm text-muted-foreground mt-0.5 md:mt-1 break-all leading-tight">
                      <Mail className="h-2.5 w-2.5 md:h-4 md:w-4 inline mr-0.5 md:mr-1 align-middle" />
                      <span className="align-middle">{user.email}</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
                  {editing ? (
                    <>
                      <button
                        onClick={handleSave}
                        className="p-1.5 md:p-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition active:scale-[0.95] touch-manipulation"
                        title="Save"
                      >
                        <Save className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setUsername(profile.username || "");
                        }}
                        className="p-1.5 md:p-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition active:scale-[0.95] touch-manipulation"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditing(true)}
                      className="p-1.5 md:p-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition active:scale-[0.95] touch-manipulation"
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4 pt-3 md:pt-4 border-t border-border">
                <div>
                  <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Member Since</p>
                  <p className="font-medium text-xs md:text-base flex items-center gap-1 md:gap-2">
                    <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="truncate">
                      {(() => {
                        // Validate created_at exists and is not empty
                        if (!profile.created_at || typeof profile.created_at !== 'string' || profile.created_at.trim() === '') {
                          return "N/A";
                        }
                        
                        try {
                          const date = new Date(profile.created_at);
                          // Check if date is valid
                          if (isNaN(date.getTime()) || date.getTime() === 0) {
                            return "N/A";
                          }
                          // Additional validation: check if date is reasonable (not too far in past/future)
                          const now = Date.now();
                          const dateTime = date.getTime();
                          // Allow dates from 1970 to 100 years in the future
                          if (dateTime < 0 || dateTime > now + (100 * 365 * 24 * 60 * 60 * 1000)) {
                            return "N/A";
                          }
                          return format(date, "MMM d, yyyy");
                        } catch (error) {
                          console.error('Error formatting date:', error);
                          return "N/A";
                        }
                      })()}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Balance</p>
                  <p className="font-medium text-sm md:text-lg truncate">{formatCurrency(profile.balance, currency)}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-3 md:p-6">
              <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4 md:h-5 md:w-5" />
                Settings
              </h3>
              <div className="space-y-2">
                <Link
                  href="/preferences"
                  className="w-full flex items-center justify-between p-2.5 md:p-4 bg-muted/50 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation"
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <Settings className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="font-medium text-xs md:text-base">Preferences</span>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </Link>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="w-full flex items-center justify-between p-2.5 md:p-4 bg-muted/50 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation"
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <Key className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="font-medium text-xs md:text-base">Change Password</span>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </button>
                <PushNotificationSettings />
                <button
                  onClick={() => {
                    if (profile.two_factor_enabled) {
                      setShow2FAManage(true);
                    } else {
                      setShow2FASetup(true);
                    }
                  }}
                  className="w-full flex items-center justify-between p-2.5 md:p-4 bg-muted/50 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation"
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    {profile.two_factor_enabled ? (
                      <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Shield className="h-4 w-4 md:h-5 md:w-5" />
                    )}
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-xs md:text-base">Two-Factor Authentication</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        {profile.two_factor_enabled ? "Enabled" : "Not enabled"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <ChangePasswordDialog
              isOpen={showChangePassword}
              onClose={() => setShowChangePassword(false)}
            />
            <TwoFactorSetup
              isOpen={show2FASetup}
              onClose={async () => {
                setShow2FASetup(false);
                // Clear cache to ensure fresh data
                if (user) {
                  const { cache, CACHE_KEYS } = await import('@/lib/cache');
                  cache.remove(CACHE_KEYS.USER_PROFILE(user.id));
                }
              }}
              onComplete={async () => {
                // Clear cache and refresh profile
                if (user) {
                  const { cache, CACHE_KEYS } = await import('@/lib/cache');
                  cache.remove(CACHE_KEYS.USER_PROFILE(user.id));
                }
                await fetchProfile(true);
                setShow2FASetup(false);
              }}
            />
            <TwoFactorManage
              isOpen={show2FAManage}
              onClose={async () => {
                setShow2FAManage(false);
                // Clear cache to ensure fresh data
                if (user) {
                  const { cache, CACHE_KEYS } = await import('@/lib/cache');
                  cache.remove(CACHE_KEYS.USER_PROFILE(user.id));
                }
              }}
              onComplete={async () => {
                // Clear cache and refresh profile
                if (user) {
                  const { cache, CACHE_KEYS } = await import('@/lib/cache');
                  cache.remove(CACHE_KEYS.USER_PROFILE(user.id));
                }
                await fetchProfile(true);
                setShow2FAManage(false);
                // Clear 2FA verification on disable
                clear2FAVerification();
              }}
            />

            {/* My Wagers Section */}
            <div className="bg-card border border-border rounded-lg p-3 md:p-6">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h3 className="text-sm md:text-lg font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 md:h-5 md:w-5" />
                  My Wagers
                </h3>
                <div className="flex items-center gap-3">
                  <Link
                    href="/history"
                    className="text-xs md:text-sm text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    <History className="h-3 w-3 md:h-4 md:w-4" />
                    History
                  </Link>
                  <Link
                    href="/create"
                    className="text-xs md:text-sm text-primary hover:underline font-medium"
                  >
                    Create New →
                  </Link>
                </div>
              </div>
              
              {loadingWagers ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Loading wagers...</p>
                </div>
              ) : myWagers.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground mb-2">You haven't created any wagers yet</p>
                  <Link
                    href="/create"
                    className="text-xs md:text-sm text-primary hover:underline font-medium"
                  >
                    Create your first wager →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {myWagers.map((wager) => (
                    <Link
                      key={wager.id}
                      href={`/wager/${wager.id}`}
                      className="block p-3 bg-muted/50 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-xs md:text-sm font-semibold truncate">{wager.title}</h4>
                            {wager.is_public ? (
                              <div title="Public">
                                <Eye className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                              </div>
                            ) : (
                              <div title="Private">
                                <EyeOff className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] md:text-xs text-muted-foreground">
                            <span>{wager.entries_count} {wager.entries_count === 1 ? 'entry' : 'entries'}</span>
                            <span>•</span>
                            <span>{formatCurrency(wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}</span>
                            <span>•</span>
                            <span className={`${
                              wager.status === "OPEN" 
                                ? "text-green-600 dark:text-green-400" 
                                : wager.status === "RESOLVED" || wager.status === "SETTLED"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-600 dark:text-gray-400"
                            }`}>
                              {wager.status}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats Card */}
          <div className="space-y-3 md:space-y-6 order-1 md:order-2">
            <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-lg p-3 md:p-6">
              <p className="text-[10px] md:text-sm opacity-90 mb-1 md:mb-2">Total Balance</p>
              <h2 className="text-lg md:text-3xl font-bold mb-2 md:mb-4">{formatCurrency(profile.balance, currency)}</h2>
              <button
                onClick={() => router.push("/wallet")}
                className="text-[10px] md:text-sm underline opacity-90 hover:opacity-100 active:opacity-100 touch-manipulation"
              >
                View Wallet →
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

