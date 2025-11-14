"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { User, Mail, Calendar, LogOut, Settings, Edit2, Save, X } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  balance: number;
  created_at: string;
}

export default function Profile() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;

  const getUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      router.push("/");
      return;
    }
    setUser(data.user);
  }, [supabase, router]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching profile:", error);
      return;
    }

    if (profileData) {
      setProfile(profileData);
      setUsername(profileData.username || "");
    } else {
      // Create profile if it doesn't exist
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ id: user.id, balance: 1000, username: user.email?.split("@")[0] || "User" })
        .select()
        .single();
      if (newProfile) {
        setProfile(newProfile);
        setUsername(newProfile.username || "");
      }
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, [getUser, supabase]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

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
    if (!user || !username.trim()) {
      toast({
        title: "Error",
        description: "Username cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: username.trim() })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success!",
        description: "Profile updated successfully",
      });
      setEditing(false);
      fetchProfile();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  if (loading) {
    return (
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!user || !profile) {
    return (
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Please log in to view profile</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Profile</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {/* Profile Card */}
          <div className="md:col-span-2 space-y-4 md:space-y-6">
            <div className="bg-card border border-border rounded-lg p-4 md:p-6">
              <div className="flex items-start justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold truncate">
                      {editing ? (
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-lg md:text-2xl"
                          placeholder="Username"
                        />
                      ) : (
                        profile.username || user.email?.split("@")[0] || "User"
                      )}
                    </h2>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4" />
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button
                        onClick={handleSave}
                        className="p-2 md:p-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition active:scale-[0.95] touch-manipulation"
                        title="Save"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setUsername(profile.username || "");
                        }}
                        className="p-2 md:p-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition active:scale-[0.95] touch-manipulation"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditing(true)}
                      className="p-2 md:p-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition active:scale-[0.95] touch-manipulation"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(profile.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Account Balance</p>
                  <p className="font-medium text-lg">{formatCurrency(profile.balance, currency)}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 md:p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Settings
              </h3>
              <div className="space-y-3">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between p-4 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition active:scale-[0.98] touch-manipulation"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Logout</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="space-y-4 md:space-y-6">
            <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-lg p-4 md:p-6">
              <p className="text-sm opacity-90 mb-2">Total Balance</p>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{formatCurrency(profile.balance, currency)}</h2>
              <button
                onClick={() => router.push("/wallet")}
                className="text-sm underline opacity-90 hover:opacity-100 active:opacity-100 touch-manipulation"
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

