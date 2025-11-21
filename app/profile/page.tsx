"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { User, Mail, Calendar, Settings, Edit2, Save, X, ChevronRight, Shield, ShieldCheck, Trophy, Eye, EyeOff, Key, History, LogOut, Upload, Camera, Wallet as WalletIcon, Plus, TrendingUp, Users } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { format } from "date-fns";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { TwoFactorManage } from "@/components/two-factor-manage";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { PushNotificationSettings } from "@/components/push-notification-settings";
import { CreateWagerModal } from "@/components/create-wager-modal";
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
  const { user, loading: authLoading, logout } = useAuth({
    requireAuth: true,
    redirectTo: "/wagers?login=true"
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FAManage, setShow2FAManage] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showCreateWagerModal, setShowCreateWagerModal] = useState(false);
  const [myWagers, setMyWagers] = useState<any[]>([]);
  const [loadingWagers, setLoadingWagers] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfile = useCallback(async (force = false) => {
    if (!user) return;

    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;

    // Always fetch fresh data from API (no cache)
    try {
      setLoading(true);
      const { profileApi } = await import('@/lib/api-client');
      const response = await profileApi.get();
      const profileData = response.profile;

      if (profileData) {
        setProfile(profileData);
        const initialUsername = profileData.username || "";
        setUsername(initialUsername);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, supabase]);

  // Debounced refetch function for subscriptions
  const debouncedRefetchProfile = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchProfile(true);
    }, 1000); // Debounce by 1 second
  }, [fetchProfile]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  const fetchMyWagers = useCallback(async () => {
    if (!user) return;
    
    setLoadingWagers(true);
    try {
      const { data: wagers, error: wagersError } = await supabase
        .from("wagers")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (wagersError) {
        return;
      }

      if (wagers && wagers.length > 0) {
        // Fetch all entry counts in a single query
        const wagerIds = wagers.map(w => w.id);
        const { data: entries } = await supabase
          .from("wager_entries")
          .select("wager_id")
          .in("wager_id", wagerIds);

        // Count entries per wager
        const entryCounts = entries?.reduce((acc, entry) => {
          acc[entry.wager_id] = (acc[entry.wager_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        const wagersWithCounts = wagers.map(wager => ({
          ...wager,
          entries_count: entryCounts[wager.id] || 0,
        }));

        setMyWagers(wagersWithCounts);
      } else {
        setMyWagers([]);
      }
    } catch (error) {
      setMyWagers([]);
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
          debouncedRefetchProfile();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [user, supabase]); // Removed fetchProfile and debouncedRefetchProfile from dependencies

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

    try {
      const { profileApi } = await import('@/lib/api-client');
      const response = await profileApi.update({ username: trimmedUsername });
      
      // Update profile state immediately
      setProfile(response.profile);
      
      // Trigger profile update event for sidebar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('profile-updated'));
      }
      
      toast({
        title: "Profile updated!",
        description: "Your changes have been saved",
      });
      setEditing(false);
      // Clear cache and refresh profile in background
      const { cache, CACHE_KEYS } = await import('@/lib/cache');
      cache.remove(CACHE_KEYS.USER_PROFILE(user.id));
      fetchProfile(true).catch(() => {});
    } catch (error: any) {
      // Check for unique constraint violation or validation error
      const errorMessage = error?.message || "Something went wrong. Please try again";
      if (errorMessage.includes('taken') || errorMessage.includes('already')) {
        toast({
          title: "That username's taken",
          description: "Someone else is using that username. Try a different one.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Couldn't update profile",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      // Check if avatars bucket exists, if not, show helpful error
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        throw new Error('Unable to access storage. Please contact support.');
      }

      const avatarsBucket = buckets?.find(b => b.name === 'avatars');
      if (!avatarsBucket) {
        toast({
          title: "Storage not configured",
          description: "Avatar storage bucket is not set up. Please contact support.",
          variant: "destructive",
        });
        setUploadingAvatar(false);
        e.target.value = '';
        return;
      }

      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName; // Store directly in bucket root, not in subfolder

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        // Check if it's a permission/RLS error
        if (uploadError.message.includes('new row violates row-level security') || 
            uploadError.message.includes('permission denied') ||
            uploadError.message.includes('row-level security')) {
          toast({
            title: "Storage permission error",
            description: "The storage bucket RLS policies are blocking uploads. Please disable RLS on the 'avatars' bucket in Supabase Dashboard, or make it fully public.",
            variant: "destructive",
          });
          setUploadingAvatar(false);
          e.target.value = '';
          return;
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Update profile via API
      const { profileApi } = await import('@/lib/api-client');
      await profileApi.update({ avatar_url: avatarUrl });

      // Clear cache and refresh
      const { cache, CACHE_KEYS } = await import('@/lib/cache');
      cache.remove(CACHE_KEYS.USER_PROFILE(user.id));
      await fetchProfile(true);

      // Trigger profile update event for sidebar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('profile-updated'));
      }

      toast({
        title: "Avatar updated!",
        description: "Your profile picture has been updated",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Upload failed",
        description: "Couldn't upload your avatar. Please try again",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = async () => {
    try {
      clear2FAVerification();
      await logout();
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
            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2 md:hidden">
              <BackButton fallbackHref="/wagers" />
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold">Profile</h1>
            </div>
            <h1 className="hidden md:block text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Profile</h1>
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
            {/* Enhanced Profile Header Card */}
            <div className="bg-gradient-to-br from-card via-card to-primary/5 border border-border rounded-xl p-4 md:p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="relative group">
                    <div className="h-16 w-16 md:h-24 md:w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-primary/20">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.username || "Avatar"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-8 w-8 md:h-12 md:w-12 text-primary" />
                      )}
                    </div>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity backdrop-blur-sm"
                      title="Upload avatar"
                    >
                      {uploadingAvatar ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                      ) : (
                        <Camera className="h-5 w-5 md:h-6 md:w-6 text-white" />
                      )}
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg md:text-2xl font-bold truncate">
                        {editing ? (
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-2 py-1.5 md:px-3 md:py-2 border border-input rounded-md bg-background text-foreground text-sm md:text-xl font-bold"
                            placeholder="Username"
                            autoFocus
                          />
                        ) : (
                          profile.username || "User"
                        )}
                      </h2>
                      {!editing && (
                        <button
                          onClick={() => {
                            const currentUsername = profile.username || "";
                            setUsername(currentUsername);
                            setEditing(true);
                          }}
                          className="p-1 hover:bg-muted rounded transition active:scale-95 touch-manipulation"
                          title="Edit username"
                        >
                          <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                      <Mail className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="truncate">{user.email}</span>
                    </p>
                    <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                      <span>
                        Member since {(() => {
                          if (!profile.created_at || typeof profile.created_at !== 'string' || profile.created_at.trim() === '') {
                            return "N/A";
                          }
                          try {
                            const date = new Date(profile.created_at);
                            if (isNaN(date.getTime()) || date.getTime() === 0) {
                              return "N/A";
                            }
                            const now = Date.now();
                            const dateTime = date.getTime();
                            if (dateTime < 0 || dateTime > now + (100 * 365 * 24 * 60 * 60 * 1000)) {
                              return "N/A";
                            }
                            return format(date, "MMM yyyy");
                          } catch (error) {
                            return "N/A";
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                {editing && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={handleSave}
                      className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition active:scale-95 touch-manipulation"
                      title="Save"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setUsername(profile.username || "");
                      }}
                      className="p-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition active:scale-95 touch-manipulation"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Streamlined Settings */}
            <div className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="text-sm md:text-base font-semibold mb-3 md:mb-4 text-muted-foreground uppercase tracking-wide">Account Settings</h3>
              <div className="space-y-1.5">
                <Link
                  href="/preferences"
                  className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation group"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="font-medium text-sm">Preferences</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation group"
                >
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="font-medium text-sm">Change Password</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
                  className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation group"
                >
                  <div className="flex items-center gap-3">
                    {profile.two_factor_enabled ? (
                      <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Shield className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-sm">Two-Factor Auth</span>
                      <span className="text-xs text-muted-foreground">
                        {profile.two_factor_enabled ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
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

            {/* Enhanced My Wagers Section */}
            <div className="bg-card border border-border rounded-xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span>My Wagers</span>
                  {myWagers.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">({myWagers.length})</span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <Link
                    href="/history"
                    className="p-2 hover:bg-muted rounded-lg transition active:scale-95 touch-manipulation"
                    title="View history"
                  >
                    <History className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  <button
                    onClick={() => setShowCreateWagerModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition active:scale-95 touch-manipulation text-xs font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New</span>
                  </button>
                </div>
              </div>
              
              {loadingWagers ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading wagers...</p>
                </div>
              ) : myWagers.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Trophy className="h-8 w-8 text-primary/60" />
                  </div>
                  <p className="text-sm font-medium mb-1">No wagers yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Start creating and sharing wagers with others</p>
                  <button
                    onClick={() => setShowCreateWagerModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition active:scale-95 touch-manipulation text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Wager
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {myWagers.map((wager) => (
                    <Link
                      key={wager.id}
                      href={`/wager/${wager.id}`}
                      className="block p-3 bg-muted/30 hover:bg-muted rounded-lg transition-all active:scale-[0.98] touch-manipulation border border-transparent hover:border-border"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="text-sm font-semibold truncate">{wager.title}</h4>
                            {wager.is_public ? (
                              <div title="Public">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              </div>
                            ) : (
                              <div title="Private">
                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              </div>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              wager.status === "OPEN" 
                                ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                                : wager.status === "RESOLVED" || wager.status === "SETTLED"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                            }`}>
                              {wager.status === "SETTLED" ? "Settled" : wager.status === "RESOLVED" ? "Resolved" : wager.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium">{wager.entries_count} {wager.entries_count === 1 ? 'entry' : 'entries'}</span>
                            <span>•</span>
                            <span>{formatCurrency(wager.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-3 md:space-y-6 order-1 md:order-2">
            <button
              onClick={() => router.push("/wallet")}
              className="w-full bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all active:scale-[0.98] touch-manipulation text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                <WalletIcon className="h-5 w-5" />
                <span className="text-xs md:text-sm font-medium opacity-90">Wallet</span>
              </div>
              <h2 className="text-xl md:text-3xl font-bold mb-3">{formatCurrency(profile.balance, currency)}</h2>
              <span className="text-xs md:text-sm opacity-80 flex items-center gap-1">
                Manage funds
                <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
              </span>
            </button>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href="/history"
                  className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition active:scale-95 touch-manipulation group"
                >
                  <div className="flex items-center gap-3">
                    <History className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-sm font-medium">Wager History</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link
                  href="/leaderboard"
                  className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition active:scale-95 touch-manipulation group"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-sm font-medium">Leaderboard</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <button
                  onClick={() => setShowCreateWagerModal(true)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-lg transition active:scale-95 touch-manipulation group"
                >
                  <div className="flex items-center gap-3">
                    <Plus className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-sm font-medium">Create Wager</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Stats Summary */}
            {myWagers.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 md:p-6">
                <h3 className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Wagers Created</span>
                    </div>
                    <span className="text-sm font-bold">{myWagers.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Total Entries</span>
                    </div>
                    <span className="text-sm font-bold">
                      {myWagers.reduce((sum, w) => sum + (w.entries_count || 0), 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Open Wagers</span>
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {myWagers.filter(w => w.status === 'OPEN').length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {user && (
        <CreateWagerModal
          open={showCreateWagerModal}
          onOpenChange={setShowCreateWagerModal}
          onSuccess={() => {
            // Refresh wagers list when wager is successfully created
            fetchMyWagers();
          }}
        />
      )}
    </main>
  );
}

