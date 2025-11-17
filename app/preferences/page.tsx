"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Bell, BellOff, X, Plus, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

const COMMON_TAGS = [
  "bitcoin", "ethereum", "stocks", "forex", "election", "football", "basketball",
  "movies", "music", "rain", "temperature", "tech", "ai", "blockchain"
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
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<{
    preferred_categories: string[];
    preferred_tags: string[];
    custom_categories: string[];
    notification_enabled: boolean;
    notification_types: string[];
  }>({
    preferred_categories: [],
    preferred_tags: [],
    custom_categories: [],
    notification_enabled: true,
    notification_types: [],
  });
  
  const [customCategories, setCustomCategories] = useState<Array<{ id: string; name: string; icon?: string }>>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/wagers?login=true");
        return;
      }
      setUser(data.user);
    };

    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, [supabase, router]);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setPreferences({
          preferred_categories: data.preferred_categories || [],
          preferred_tags: data.preferred_tags || [],
          custom_categories: data.custom_categories || [],
          notification_enabled: data.notification_enabled ?? true,
          notification_types: data.notification_types || [],
        });
      }
      
      // Fetch custom categories
      const { data: customCats } = await supabase
        .from("custom_categories")
        .select("*")
        .order("usage_count", { ascending: false })
        .limit(20);
      
      if (customCats) {
        setCustomCategories(customCats);
      }
      
      // Fetch available tags from wagers
      const { data: wagersData } = await supabase
        .from("wagers")
        .select("tags")
        .not("tags", "is", null);
      
      const allTags = new Set<string>();
      wagersData?.forEach(wager => {
        if (wager.tags && Array.isArray(wager.tags)) {
          wager.tags.forEach(tag => allTags.add(tag));
        }
      });
      
      setAvailableTags([...allTags].sort());
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
  }, [user, supabase, toast]);

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

  const handleTagToggle = (tag: string) => {
    setPreferences((prev) => {
      const tags = prev.preferred_tags || [];
      const newTags = tags.includes(tag)
        ? tags.filter((t) => t !== tag)
        : [...tags, tag];
      
      return { ...prev, preferred_tags: newTags };
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

  const handleCreateCustomCategory = async () => {
    if (!newCategoryName.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from("custom_categories")
        .insert({
          name: newCategoryName.trim(),
          icon: newCategoryIcon || "📌",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint
          toast({
            title: "Category exists",
            description: "This category already exists.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else if (data) {
        setCustomCategories([...customCategories, data]);
        setPreferences((prev) => ({
          ...prev,
          custom_categories: [...(prev.custom_categories || []), data.id],
        }));
        setNewCategoryName("");
        setNewCategoryIcon("");
        setShowAddCategory(false);
        toast({
          title: "Category created!",
          description: "Your custom category has been added.",
        });
      }
    } catch (error) {
      console.error("Error creating category:", error);
      toast({
        title: "Error",
        description: "Failed to create category.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          preferred_categories: preferences.preferred_categories,
          preferred_tags: preferences.preferred_tags,
          custom_categories: preferences.custom_categories,
          notification_enabled: preferences.notification_enabled,
          notification_types: preferences.notification_types,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

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
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Preferences</h1>
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

          {/* Custom Categories */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-sm md:text-lg font-semibold">Custom Categories</h3>
              <button
                onClick={() => setShowAddCategory(!showAddCategory)}
                className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm bg-muted hover:bg-muted/80 rounded-md transition active:scale-95 touch-manipulation flex items-center gap-1.5 md:gap-2"
              >
                <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Add Category</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
            
            {showAddCategory && (
              <div className="mb-3 md:mb-4 p-3 md:p-4 bg-muted/50 rounded-lg space-y-2 md:space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Category Name</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Gaming"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Icon (Optional)</label>
                  <input
                    type="text"
                    value={newCategoryIcon}
                    onChange={(e) => setNewCategoryIcon(e.target.value)}
                    placeholder="🎮"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateCustomCategory}
                    className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 transition active:scale-95 touch-manipulation"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCategory(false);
                      setNewCategoryName("");
                      setNewCategoryIcon("");
                    }}
                    className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/80 transition active:scale-95 touch-manipulation"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {customCategories.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
                {customCategories.map((cat) => {
                  const isSelected = preferences.custom_categories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setPreferences((prev) => {
                          const cats = prev.custom_categories || [];
                          const newCats = cats.includes(cat.id)
                            ? cats.filter((c) => c !== cat.id)
                            : [...cats, cat.id];
                          return { ...prev, custom_categories: newCats };
                        });
                      }}
                      className={`p-2.5 md:p-4 rounded-lg border-2 transition active:scale-[0.98] touch-manipulation ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="text-xl md:text-2xl mb-1 md:mb-2">{cat.icon || "📌"}</div>
                      <div className="text-xs md:text-sm font-medium">{cat.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tag Filtering */}
          <div>
            <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4 flex items-center gap-1.5 md:gap-2">
              <Tag className="h-4 w-4 md:h-5 md:w-5" />
              Preferred Tags
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">
              Select tags to filter wagers more specifically
            </p>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {[...COMMON_TAGS, ...availableTags].slice(0, 30).map((tag) => {
                const isSelected = preferences.preferred_tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm transition active:scale-95 touch-manipulation ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {preferences.preferred_tags.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No tags selected
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

