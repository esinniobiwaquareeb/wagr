"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/loading-spinner";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_CURRENCY, type Currency, CURRENCY_SYMBOLS, formatCurrency } from "@/lib/currency";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";
import { Globe, Lock, Tag } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { wagersApi, walletApi } from "@/lib/api-client";

import { WAGER_CATEGORIES, COMMON_SIDES, DEFAULT_WAGER_AMOUNT, PLATFORM_FEE_PERCENTAGE, UI } from "@/lib/constants";

// Common amount presets
const AMOUNT_PRESETS = [10, 25, 50, 100, 250, 500, 1000];

export default function CreateWager() {
  const router = useRouter();
  const { user, loading } = useAuth({ 
    requireAuth: true, 
    redirectTo: "/wagers?login=true" 
  });
  const supabase = createClient(); // Create Supabase client for database operations
  const [submitting, setSubmitting] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
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
    selectedSideTemplate: null as { sideA: string; sideB: string } | null,
    creatorSide: "a" as "a" | "b", // Which side the creator will join
  });

  // Fetch user balance when user is available
  const fetchUserBalance = useCallback(async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();
    
    if (profile) {
      setUserBalance(profile.balance || 0);
    } else {
      setUserBalance(0);
    }
  }, [user, supabase]);

  // Check balance whenever amount changes
  const checkBalance = useCallback(async () => {
    if (!user || !formData.amount) {
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    setCheckingBalance(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .single();
      
      if (profile) {
        setUserBalance(profile.balance || 0);
      }
    } catch (error) {
      console.error("Error checking balance:", error);
    } finally {
      setCheckingBalance(false);
    }
  }, [user, formData.amount, supabase]);

  useEffect(() => {
    if (user && formData.amount) {
      const timeoutId = setTimeout(() => {
        checkBalance();
      }, 500); // Debounce balance check
      return () => clearTimeout(timeoutId);
    }
  }, [user, formData.amount, checkBalance]);

  // Fetch balance when user is available
  useEffect(() => {
    fetchUserBalance();
  }, [fetchUserBalance]);

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
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to create a wager.",
        variant: "destructive",
      });
      return;
    }

    // TypeScript guard - user is guaranteed to be non-null after this check
    const currentUser = user;
    setSubmitting(true);

    try {
      // Validate title
      const trimmedTitle = formData.title.trim();
      if (!trimmedTitle) {
        toast({
          title: "What's your wager about?",
          description: "Give your wager a title so people know what they're wagering on.",
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
          description: "Enter what people can wager on for each side.",
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
          title: "How much to wager?",
          description: "Set the amount people need to place a wager.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const amount = parseFloat(formData.amount);
      if (isNaN(amount)) {
        toast({
          title: "That's not a valid amount",
          description: "Enter a number for how much each wager costs.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (amount <= 0) {
        toast({
          title: "Amount needs to be more than zero",
          description: "The wager amount has to be at least ₦1.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (amount < 1) {
        toast({
          title: "Minimum wager is ₦1",
          description: "The smallest wager amount is ₦1.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Check user balance before creating wager
      try {
        const balanceResponse = await walletApi.getBalance();
        if (balanceResponse.balance < amount) {
          toast({
            title: "Insufficient balance",
            description: `You need ${formatCurrency(amount, formData.currency)} to create this wager. Your current balance is ${formatCurrency(balanceResponse.balance, formData.currency)}.`,
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      } catch (error) {
        toast({
          title: "Error checking balance",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate deadline (required)
      if (!formData.deadline || !formData.deadline.trim()) {
        toast({
          title: "Deadline is required",
          description: "Please set a deadline for your wager.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const { localToUTC, isDeadlineValid } = await import('@/lib/deadline-utils');
      
      // Validate deadline is in the future
      if (!isDeadlineValid(formData.deadline)) {
        toast({
          title: "Invalid deadline",
          description: "Please enter a valid date and time in the future.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
      
      // Convert local datetime to UTC ISO string for storage
      const deadlineUTC = localToUTC(formData.deadline);
      
      if (!deadlineUTC) {
        toast({
          title: "Invalid deadline",
          description: "Please enter a valid date and time.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
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

      // Create the wager via API (handles balance deduction, wager creation, entry, and transactions)
      const response = await wagersApi.create({
        title: trimmedTitle,
        description: formData.description.trim() || undefined,
        amount: amount,
        sideA: trimmedSideA,
        sideB: trimmedSideB,
        deadline: deadlineUTC,
        category: formData.category || undefined,
        currency: formData.currency,
        isPublic: formData.isPublic,
        creatorSide: formData.creatorSide,
      });

      const newWager = response.wager;

      trackABTestEvent(AB_TESTS.CREATE_FORM_LAYOUT, formVariant, 'wager_created', {
        has_deadline: true, // Deadline is now required
        currency: formData.currency,
        is_public: formData.isPublic,
        has_category: !!formData.category,
      });
      
      toast({
        title: "Your wager is live!",
        description: `${formData.isPublic ? 'Everyone can see it now and start wagering.' : 'It\'s private for now - only you can see it.'}`,
      });
      
      // Redirect immediately - data will be fresh from API
      router.push("/wagers");
      router.refresh();
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
        <div className="max-w-6xl mx-auto p-4 py-12">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-3 md:mb-4">
          <BackButton fallbackHref="/wagers" />
        </div>
        <div className="mb-4 md:mb-8">
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Create Wager</h1>
          <p className="text-xs md:text-base text-muted-foreground">Start a new wagering opportunity</p>
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
            {/* Balance validation */}
            {formData.amount && userBalance !== null && (() => {
              const amount = parseFloat(formData.amount);
              const isValidAmount = !isNaN(amount) && amount > 0;
              const hasEnoughBalance = isValidAmount && userBalance >= amount;
              const shortfall = isValidAmount && !hasEnoughBalance ? amount - userBalance : 0;
              
              return isValidAmount && (
                <div className={`mt-2 p-2.5 rounded-lg border ${
                  hasEnoughBalance 
                    ? "bg-green-500/10 border-green-500/20" 
                    : "bg-destructive/10 border-destructive/20"
                }`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={hasEnoughBalance ? "text-green-700 dark:text-green-400" : "text-destructive"}>
                      {hasEnoughBalance 
                        ? `✓ You have ${formatCurrency(userBalance, formData.currency)} available`
                        : `Insufficient balance. You need ${formatCurrency(shortfall, formData.currency)} more.`
                      }
                    </span>
                  </div>
                  {!hasEnoughBalance && (
                    <Link 
                      href="/wallet" 
                      className="text-xs text-primary hover:underline mt-1 block font-medium"
                    >
                      Add money to wallet →
                    </Link>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Creator Side Selection */}
          {formData.sideA && formData.sideB && (
            <div>
              <label className="block text-xs font-medium mb-1.5">Which side are you joining? *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, creatorSide: "a" })}
                  className={`p-3 rounded-lg border-2 transition ${
                    formData.creatorSide === "a"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-sm font-semibold mb-1">{formData.sideA}</div>
                  <div className="text-xs text-muted-foreground">Side A</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, creatorSide: "b" })}
                  className={`p-3 rounded-lg border-2 transition ${
                    formData.creatorSide === "b"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-sm font-semibold mb-1">{formData.sideB}</div>
                  <div className="text-xs text-muted-foreground">Side B</div>
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                You'll automatically join this side when you create the wager.
              </p>
            </div>
          )}

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
                {WAGER_CATEGORIES.map((category) => (
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

          {/* Description & Deadline */}
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
              <label className="block text-xs font-medium mb-1">
                Deadline <span className="text-destructive">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
          </div>

          {(() => {
            const amount = parseFloat(formData.amount);
            const isValidAmount = !isNaN(amount) && amount > 0;
            const hasEnoughBalance = isValidAmount && userBalance !== null && userBalance >= amount;
            const hasDeadline = formData.deadline && formData.deadline.trim() !== "";
            const isFormValid = formData.title && formData.sideA && formData.sideB && formData.amount && hasDeadline;
            const canSubmit = isFormValid && hasEnoughBalance && !submitting;
            
            return (
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation mt-2 text-sm"
              >
                {submitting ? "Creating..." : "Create Wager"}
              </button>
            );
          })()}
        </form>
      </div>
    </main>
  );
}
