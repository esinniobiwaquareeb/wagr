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
          title: "What's your wager about?",
          description: "Give your wager a title so people know what they're betting on.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
      if (trimmedTitle.length < 5) {
        toast({
          title: "Title is too short",
          description: "Make it at least 5 characters so it's clear what the wager is about.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
      if (trimmedTitle.length > 200) {
        toast({
          title: "Title is too long",
          description: "Keep it under 200 characters to keep it concise.",
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
          title: "Need both options",
          description: "Enter what people can bet on for each side.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedSideA.length < 2 || trimmedSideB.length < 2) {
        toast({
          title: "Options are too short",
          description: "Each option needs to be at least 2 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedSideA.length > 100 || trimmedSideB.length > 100) {
        toast({
          title: "Options are too long",
          description: "Keep each option under 100 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (trimmedSideA.toLowerCase() === trimmedSideB.toLowerCase()) {
        toast({
          title: "Options need to be different",
          description: "The two options can't be the same thing.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate amount
      if (!formData.amount || formData.amount.trim() === '') {
        toast({
          title: "How much to bet?",
          description: "Set the amount people need to place a bet.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const amount = parseFloat(formData.amount);
      if (isNaN(amount)) {
        toast({
          title: "That's not a valid amount",
          description: "Enter a number for how much each bet costs.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (amount <= 0) {
        toast({
          title: "Amount needs to be more than zero",
          description: "The bet amount has to be at least ₦1.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (amount < 1) {
        toast({
          title: "Minimum bet is ₦1",
          description: "The smallest bet amount is ₦1.",
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
            title: "Deadline needs to be later",
            description: "Pick a date and time that hasn't passed yet.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      // Validate description length if provided
      if (formData.description.trim() && formData.description.trim().length > 1000) {
        toast({
          title: "Description is too long",
          description: "Keep it under 1000 characters.",
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
      
      // Invalidate cache to ensure new wager shows up immediately
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('wagers_cache');
          // Also clear any individual wager caches
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('wager_')) {
              sessionStorage.removeItem(key);
            }
          });
        } catch (e) {
          // Ignore
        }
      }
      
      toast({
        title: "Your wager is live!",
        description: `${formData.isPublic ? 'Everyone can see it now and start betting.' : 'It\'s private for now - only you can see it.'}`,
      });
      
      // Small delay to ensure database is updated, then redirect
      setTimeout(() => {
        router.push("/");
        router.refresh(); // Force refresh to show new wager
      }, 100);
    } catch (error) {
      console.error("Error creating wager:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Something went wrong. Give it another try.");
      
      toast({
        title: "Couldn't create wager",
        description: errorMessage,
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

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium mb-1">Wager Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Will it rain tomorrow?"
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              maxLength={200}
            />
          </div>

          {/* Side Selection */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Choose Sides *</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
              {COMMON_SIDES.slice(0, -1).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleSideTemplateSelect(option.value)}
                  className={`p-1.5 rounded border-2 transition text-[10px] sm:text-xs font-medium ${
                    formData.selectedSideTemplate === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {option.label.split(' / ')[0]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Side A *</label>
                <input
                  type="text"
                  required
                  value={formData.sideA}
                  onChange={(e) => setFormData({ ...formData, sideA: e.target.value })}
                  placeholder="e.g., Yes"
                  className="w-full px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Side B *</label>
                <input
                  type="text"
                  required
                  value={formData.sideB}
                  onChange={(e) => setFormData({ ...formData, sideB: e.target.value })}
                  placeholder="e.g., No"
                  className="w-full px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  maxLength={100}
                />
              </div>
            </div>
          </div>

          {/* Entry Amount */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Entry Amount *</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAmountPreset(preset)}
                  className={`px-2 py-1 rounded border-2 transition text-[10px] sm:text-xs font-medium ${
                    formData.amount === preset.toString()
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {CURRENCY_SYMBOLS[formData.currency]}{preset}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value as Currency })
                }
                className="px-2 py-1.5 text-xs border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                placeholder="Custom amount"
                min="1"
                step="0.01"
                className="flex-1 px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
          </div>

          {/* Category & Visibility - Combined */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">None</option>
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Visibility</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPublic: true })}
                  className={`flex-1 flex items-center justify-center gap-1 p-2 rounded border-2 transition text-xs ${
                    formData.isPublic
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Public</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPublic: false })}
                  className={`flex-1 flex items-center justify-center gap-1 p-2 rounded border-2 transition text-xs ${
                    !formData.isPublic
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Private</span>
                </button>
              </div>
            </div>
          </div>

          {/* Description & Deadline - Optional, Compact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional details..."
                rows={2}
                className="w-full px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition resize-none"
                maxLength={500}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Deadline</label>
              <input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !formData.title || !formData.sideA || !formData.sideB || !formData.amount}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation mt-2 text-sm"
          >
            {submitting ? "Creating..." : "Create Wager"}
          </button>
        </form>
      </div>
    </main>
  );
}
