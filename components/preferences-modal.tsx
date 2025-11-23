"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Settings, Save, Bell, BellOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PreferencesModal({ isOpen, onClose }: PreferencesModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
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
    if (isOpen && user) {
      fetchPreferences();
    }
  }, [isOpen, user, fetchPreferences]);

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
      onClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferences
          </DialogTitle>
          <DialogDescription>
            Customize your wagr experience
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-48" />
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Preferred Categories */}
            <div>
              <h3 className="text-base font-semibold mb-2">Preferred Categories</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select the types of events you want to see in your feed
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                {CATEGORIES.map((category) => {
                  const isSelected = preferences.preferred_categories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryToggle(category.id)}
                      className={`p-3 md:p-4 rounded-lg border-2 transition active:scale-[0.98] touch-manipulation min-h-[44px] ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="text-xl md:text-2xl mb-1">{category.icon}</div>
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  {preferences.notification_enabled ? (
                    <Bell className="h-5 w-5" />
                  ) : (
                    <BellOff className="h-5 w-5" />
                  )}
                  Notifications
                </h3>
                <button
                  onClick={() => setPreferences((prev) => ({ ...prev, notification_enabled: !prev.notification_enabled }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition active:scale-95 touch-manipulation min-h-[44px] ${
                    preferences.notification_enabled
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {preferences.notification_enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              
              {preferences.notification_enabled && (
                <div className="space-y-2">
                  {NOTIFICATION_TYPES.map((type) => {
                    const isSelected = preferences.notification_types.includes(type.id);
                    return (
                      <label
                        key={type.id}
                        className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition min-h-[44px]"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleNotificationTypeToggle(type.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

