"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Settings, Save, Bell, BellOff } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { preferencesApi } from "@/lib/api-client";

const CATEGORIES = [
  { id: "crypto", label: "Cryptocurrency", icon: "₿" },
  { id: "finance", label: "Finance & Stocks", icon: "📈" },
  { id: "politics", label: "Politics", icon: "🏛️" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "entertainment", label: "Entertainment", icon: "🎬" },
  { id: "technology", label: "Technology", icon: "💻" },
  { id: "religion", label: "Religion", icon: "🙏" },
  { id: "weather", label: "Weather", icon: "🌤️" },
];

const NOTIFICATION_TYPES = [
  { id: "new_wagers", label: "New Wagers", description: "Get notified when new wagers are created" },
  { id: "wager_resolved", label: "Wager Resolved", description: "Get notified when your wagers are resolved" },
  { id: "wager_ending", label: "Wager Ending Soon", description: "Get notified when wagers are about to end" },
  { id: "balance_updates", label: "Balance Updates", description: "Get notified about balance changes" },
];

export default function PreferencesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth({
    requireAuth: true,
    redirectTo: "/wagers?login=true"
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<{
    preferred_categories: string[];
    notification_enabled: boolean;
    notification_types: string[];
  }>({
    preferred_categories: [],
    notification_enabled: true,
    notification_types: [],
  });

  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await preferencesApi.get();
      const prefs = response.preferences;

      if (prefs) {
        setPreferences({
          preferred_categories: prefs.preferred_categories || [],
          notification_enabled: prefs.notification_enabled ?? true,
          notification_types: prefs.notification_types || [],
        });
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
      toast({
        title: "Error",
        description: "Failed to load preferences.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user, fetchPreferences]);

  const handleCategoryToggle = (categoryId: string) => {
    setPreferences((prev) => {
      const categories = prev.preferred_categories || [];
      const newCategories = categories.includes(categoryId)
        ? categories.filter((c) => c !== categoryId)
        : [...categories, categoryId];
      
      return { ...prev, preferred_categories: newCategories };
    });
  };

  const handleNotificationTypeToggle = (typeId: string) => {
    setPreferences((prev) => {
      const types = prev.notification_types || [];
      const newTypes = types.includes(typeId)
        ? types.filter((t) => t !== typeId)
        : [...types, typeId];
      
      return { ...prev, notification_types: newTypes };
    });
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await preferencesApi.update({
        preferred_categories: preferences.preferred_categories,
        notification_enabled: preferences.notification_enabled,
        notification_types: preferences.notification_types,
      });

      toast({
        title: "Preferences saved!",
        description: "Your preferences have been updated.",
      });
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2 md:hidden">
            <BackButton fallbackHref="/wagers" />
            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold">Preferences</h1>
          </div>
          <h1 className="hidden md:block text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Preferences</h1>
          <p className="text-xs md:text-base text-muted-foreground">Customize your wagr experience</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 md:p-6 space-y-4 md:space-y-6">
          <div>
            <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Preferred Categories</h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">
              Select the types of events you want to see in your feed
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
              {CATEGORIES.map((category) => {
                const isSelected = preferences.preferred_categories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryToggle(category.id)}
                    className={`p-2.5 md:p-4 rounded-lg border-2 transition active:scale-[0.98] touch-manipulation ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-xl md:text-2xl mb-1 md:mb-2">{category.icon}</div>
                    <div className="text-xs md:text-sm font-medium">{category.label}</div>
                  </button>
                );
              })}
            </div>
            {preferences.preferred_categories.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No categories selected - you'll see all wagers
              </p>
            )}
          </div>

          {/* Notification Preferences */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-sm md:text-lg font-semibold flex items-center gap-1.5 md:gap-2">
                {preferences.notification_enabled ? (
                  <Bell className="h-4 w-4 md:h-5 md:w-5" />
                ) : (
                  <BellOff className="h-4 w-4 md:h-5 md:w-5" />
                )}
                Notifications
              </h3>
              <button
                onClick={() => setPreferences((prev) => ({ ...prev, notification_enabled: !prev.notification_enabled }))}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition active:scale-95 touch-manipulation ${
                  preferences.notification_enabled
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {preferences.notification_enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            
            {preferences.notification_enabled && (
              <div className="space-y-2 md:space-y-3">
                {NOTIFICATION_TYPES.map((type) => {
                  const isSelected = preferences.notification_types.includes(type.id);
                  return (
                    <label
                      key={type.id}
                      className="flex items-start gap-2 md:gap-3 p-2.5 md:p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleNotificationTypeToggle(type.id)}
                        className="mt-0.5 md:mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs md:text-sm">{type.label}</div>
                        <div className="text-[10px] md:text-sm text-muted-foreground">{type.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 md:pt-4 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary text-primary-foreground py-2.5 md:py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 text-sm md:text-base"
            >
              <Save className="h-4 w-4 md:h-5 md:w-5" />
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

