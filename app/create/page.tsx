"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_CURRENCY, type Currency, CURRENCY_SYMBOLS } from "@/lib/currency";
import { Sparkles } from "lucide-react";
import { getVariant, AB_TESTS, trackABTestEvent } from "@/lib/ab-test";

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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase.from("wagers").insert({
        creator_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        amount: parseFloat(formData.amount),
        side_a: formData.sideA.trim(),
        side_b: formData.sideB.trim(),
        deadline: formData.deadline || null,
        fee_percentage: 0.01, // Platform fee is fixed at 1%
        currency: formData.currency,
        is_system_generated: false,
      });

      if (error) throw error;

      trackABTestEvent(AB_TESTS.CREATE_FORM_LAYOUT, formVariant, 'wager_created', {
        has_deadline: !!formData.deadline,
        currency: formData.currency,
      });
      
      toast({
        title: "Success!",
        description: "Wager created successfully!",
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
  }, [formData, user, supabase, toast, router]);

  if (loading || !user) {
    return (
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 py-12 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Create Wager</h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground ml-11 md:ml-0">Start a new betting opportunity</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Wager Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Will it rain tomorrow?"
              className="w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Side A *</label>
              <input
                type="text"
                required
                value={formData.sideA}
                onChange={(e) =>
                  setFormData({ ...formData, sideA: e.target.value })
                }
                placeholder="e.g., Yes"
                className="w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Side B *</label>
              <input
                type="text"
                required
                value={formData.sideB}
                onChange={(e) =>
                  setFormData({ ...formData, sideB: e.target.value })
                }
                placeholder="e.g., No"
                className="w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entry Amount *</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value as Currency })
                }
                className="px-3 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="100"
                min="1"
                step="0.01"
                className="flex-1 px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Platform fee: 1% (automatically applied)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Deadline (Optional)</label>
            <input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) =>
                setFormData({ ...formData, deadline: e.target.value })
              }
              className="w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
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
