"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_CURRENCY, type Currency, CURRENCY_SYMBOLS } from "@/lib/currency";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Globe, Lock, Tag } from "lucide-react";

// Available categories
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

// Common side options for quick selection
const COMMON_SIDES = [
  { label: "Yes / No", value: { sideA: "Yes", sideB: "No" } },
  { label: "Win / Lose", value: { sideA: "Win", sideB: "Lose" } },
  { label: "Over / Under", value: { sideA: "Over", sideB: "Under" } },
  { label: "True / False", value: { sideA: "True", sideB: "False" } },
  { label: "Higher / Lower", value: { sideA: "Higher", sideB: "Lower" } },
  { label: "Custom", value: null },
];

// Common amount presets
const AMOUNT_PRESETS = [10, 25, 50, 100, 250, 500, 1000];

export default function CreateWager() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  // A/B Testing
  const formVariant = useMemo(() => getVariant(AB_TESTS.CREATE_FORM_LAYOUT), []);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    sideA: "",
    sideB: "",
    deadline: "",
    currency: DEFAULT_CURRENCY,
    isPublic: true,
    category: "",
    tags: [] as string[],
    selectedSideTemplate: null as { sideA: string; sideB: string } | null,
  });

  const getUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      router.push("/");
      return;
    }
    setUser(data.user);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, [getUser]);

  const handleSideTemplateSelect = (template: { sideA: string; sideB: string } | null) => {
    if (template) {
      setFormData({ ...formData, selectedSideTemplate: template, sideA: template.sideA, sideB: template.sideB });
    } else {
      setFormData({ ...formData, selectedSideTemplate: null, sideA: "", sideB: "" });
    }
  };

  const handleAmountPreset = (amount: number) => {
    setFormData({ ...formData, amount: amount.toString() });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate title
      const trimmedTitle = formData.title.trim();
      if (!trimmedTitle) {
        toast({
          title: "Title required",
          description: "Please enter a wager title.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
      if (trimmedTitle.length < 5) {
        toast({
          title: "Title too short",
          description: "Title must be at least 5 characters long.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
      if (trimmedTitle.length > 200) {
        toast({
          title: "Title too long",
          description: "Title must not exceed 200 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate sides
      const trimmedSideA = formData.sideA.trim();
      const trimmedSideB = formData.sideB.trim();
      
      if (!trimmedSideA || !trimmedSideB) {
        toast({
          title: "Sides required",
          description: "Please enter both Side A and Side B.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedSideA.length < 2 || trimmedSideB.length < 2) {
        toast({
          title: "Sides too short",
          description: "Each side must be at least 2 characters long.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedSideA.length > 100 || trimmedSideB.length > 100) {
        toast({
          title: "Sides too long",
          description: "Each side must not exceed 100 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedSideA.toLowerCase() === trimmedSideB.toLowerCase()) {
        toast({
          title: "Sides must be different",
          description: "Side A and Side B cannot be the same.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate amount
      if (!formData.amount || formData.amount.trim() === '') {
        toast({
          title: "Amount required",
          description: "Please enter an entry amount.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const amount = parseFloat(formData.amount);
      if (isNaN(amount)) {
        toast({
          title: "Invalid amount",
          description: "Please enter a valid number for the entry amount.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (amount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Entry amount must be greater than zero.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (amount < 1) {
        toast({
          title: "Minimum amount",
          description: "Minimum entry amount is 1.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate deadline if provided
      if (formData.deadline) {
        const deadlineDate = new Date(formData.deadline);
        const now = new Date();
        if (deadlineDate <= now) {
          toast({
            title: "Invalid deadline",
            description: "Deadline must be in the future.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      // Validate description length if provided
      if (formData.description.trim() && formData.description.trim().length > 1000) {
        toast({
          title: "Description too long",
          description: "Description must not exceed 1000 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("wagers").insert({
        creator_id: user.id,
        title: trimmedTitle,
        description: formData.description.trim() || null,
        amount: amount,
        side_a: trimmedSideA,
        side_b: trimmedSideB,
        deadline: formData.deadline || null,
        fee_percentage: 0.01, // Platform fee is fixed at 1%
        currency: formData.currency,
        is_system_generated: false,
        is_public: formData.isPublic,
        category: formData.category || null,
        tags: formData.tags.length > 0 ? formData.tags : [],
      });

      if (error) throw error;

      trackABTestEvent(AB_TESTS.CREATE_FORM_LAYOUT, formVariant, 'wager_created', {
        has_deadline: !!formData.deadline,
        currency: formData.currency,
        is_public: formData.isPublic,
        has_category: !!formData.category,
      });
      
      // Invalidate cache
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('wagers_cache');
        } catch (e) {
          // Ignore
        }
      }
      
      toast({
        title: "Success!",
        description: `Wager created successfully! ${formData.isPublic ? 'It\'s now visible to everyone.' : 'It\'s private and only visible to you.'}`,
      });
      router.push("/");
    } catch (error) {
      console.error("Error creating wager:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create wager. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [formData, user, supabase, toast, router, formVariant]);

  if (loading || !user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 py-12 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-4 md:mb-8">
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Create Wager</h1>
          <p className="text-xs md:text-base text-muted-foreground">Start a new betting opportunity</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-3 md:p-6 lg:p-8 space-y-4 md:space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Wager Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Will it rain tomorrow?"
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              maxLength={200}
            />
          </div>

          {/* Side Selection - Radio Options */}
          <div>
            <label className="block text-xs md:text-sm font-medium mb-2 md:mb-3">Choose Sides *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2 mb-3 md:mb-4">
              {COMMON_SIDES.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleSideTemplateSelect(option.value)}
                  className={`p-2 md:p-3 rounded-lg border-2 transition text-xs md:text-sm font-medium ${
                    formData.selectedSideTemplate === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            {/* Custom Side Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
              <div>
                <label className="block text-[10px] md:text-xs text-muted-foreground mb-1">Side A *</label>
                <input
                  type="text"
                  required
                  value={formData.sideA}
                  onChange={(e) => setFormData({ ...formData, sideA: e.target.value })}
                  placeholder="e.g., Yes"
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-[10px] md:text-xs text-muted-foreground mb-1">Side B *</label>
                <input
                  type="text"
                  required
                  value={formData.sideB}
                  onChange={(e) => setFormData({ ...formData, sideB: e.target.value })}
                  placeholder="e.g., No"
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  maxLength={100}
                />
              </div>
            </div>
          </div>

          {/* Entry Amount - Presets */}
          <div>
            <label className="block text-xs md:text-sm font-medium mb-2 md:mb-3">Entry Amount *</label>
            <div className="flex flex-wrap gap-1.5 md:gap-2 mb-2 md:mb-3">
              {AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAmountPreset(preset)}
                  className={`px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg border-2 transition text-xs md:text-sm font-medium ${
                    formData.amount === preset.toString()
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {CURRENCY_SYMBOLS[formData.currency]} {preset}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value as Currency })
                }
                className="px-2 md:px-3 py-2 md:py-2.5 text-sm md:text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                  <option key={code} value={code}>
                    {symbol} {code}
                  </option>
                ))}
              </select>
              <input
                type="number"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Or enter custom amount"
                min="1"
                step="0.01"
                className="flex-1 px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1.5 md:mt-2">
              Platform fee: 1% (automatically applied)
            </p>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs md:text-sm font-medium mb-2 md:mb-3 flex items-center gap-1.5 md:gap-2">
              <Tag className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Category (Optional)
            </label>
            <p className="text-[10px] md:text-xs text-muted-foreground mb-2 md:mb-3">
              Help others find your wager by selecting a category
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: formData.category === category.id ? "" : category.id })}
                  className={`p-2.5 md:p-3 rounded-lg border-2 transition text-xs md:text-sm font-medium ${
                    formData.category === category.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-lg md:text-xl mb-1">{category.icon}</div>
                  <div className="text-[10px] md:text-xs">{category.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Visibility Toggle */}
          <div>
            <label className="block text-xs md:text-sm font-medium mb-2 md:mb-3">Visibility</label>
            <div className="flex gap-2 md:gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPublic: true })}
                className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 p-2.5 md:p-4 rounded-lg border-2 transition ${
                  formData.isPublic
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Globe className="h-4 w-4 md:h-5 md:w-5" />
                <div className="text-left">
                  <div className="font-medium text-xs md:text-base">Public</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Everyone can see and join</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPublic: false })}
                className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 p-2.5 md:p-4 rounded-lg border-2 transition ${
                  !formData.isPublic
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Lock className="h-4 w-4 md:h-5 md:w-5" />
                <div className="text-left">
                  <div className="font-medium text-xs md:text-base">Private</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Only you can see it</div>
                </div>
              </button>
            </div>
          </div>

          {/* Description - Optional */}
          <div>
            <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add more details about your wager..."
              rows={2}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition resize-none"
              maxLength={500}
            />
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Deadline - Optional */}
          <div>
            <label className="block text-xs md:text-sm font-medium mb-1.5 md:mb-2">Deadline (Optional)</label>
            <input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !formData.title || !formData.sideA || !formData.sideB || !formData.amount}
            className="w-full bg-primary text-primary-foreground py-3 md:py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation mt-4 md:mt-6 text-base"
          >
            {submitting ? "Creating..." : "Create Wager"}
          </button>
        </form>
      </div>
    </main>
  );
}
