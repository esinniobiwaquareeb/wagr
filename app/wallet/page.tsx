"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Loader2 } from "lucide-react";

interface Profile {
  balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  reference: string | null;
}

export default function Wallet() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;

  const fetchWalletData = useCallback(async () => {
    if (!user) return;

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    } else {
      // Create profile if it doesn't exist
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ id: user.id, balance: 1000 })
        .select()
        .single();
      if (newProfile) {
        setProfile(newProfile);
      }
    }

    // Fetch transactions
    const { data: transData } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (transData) {
      setTransactions(transData);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/");
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

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user, fetchWalletData]);

  // Handle payment callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const amount = searchParams.get('amount');

    if (success === 'true' && amount) {
      toast({
        title: "Payment successful!",
        description: `Successfully deposited ${formatCurrency(parseFloat(amount), currency)}.`,
      });
      fetchWalletData();
      // Clean URL
      router.replace('/wallet');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_reference: "Payment reference is missing.",
        config_error: "Payment service is not configured.",
        verification_failed: "Payment verification failed.",
        invalid_transaction: "Invalid transaction data.",
        payment_failed: "Payment was not successful.",
        balance_update_failed: "Payment received but balance update failed. Please contact support.",
        verification_error: "Error verifying payment. Please check your transaction history.",
        already_processed: "This payment has already been processed.",
      };
      
      toast({
        title: "Payment error",
        description: errorMessages[error] || "An error occurred during payment.",
        variant: "destructive",
      });
      // Clean URL
      router.replace('/wallet');
    }
  }, [searchParams, toast, currency, router, fetchWalletData]);

  // Real-time subscription for profile balance updates
  useEffect(() => {
    if (!user) return;

    const profileChannel = supabase
      .channel(`wallet-profile:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          fetchWalletData();
        }
      )
      .subscribe();

    // Real-time subscription for transactions
    const transactionsChannel = supabase
      .channel(`wallet-transactions:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchWalletData();
        }
      )
      .subscribe();

    return () => {
      profileChannel.unsubscribe();
      transactionsChannel.unsubscribe();
    };
  }, [user, supabase, fetchWalletData]);

  const handleDeposit = async () => {
    // Validate amount
    const trimmedAmount = depositAmount.trim();
    if (!trimmedAmount) {
      toast({
        title: "Amount required",
        description: "Please enter an amount to deposit.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(trimmedAmount);
    
    if (isNaN(amount)) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid number.",
        variant: "destructive",
      });
      return;
    }

    if (amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Deposit amount must be greater than zero.",
        variant: "destructive",
      });
      return;
    }

    if (amount < 100) {
      toast({
        title: "Minimum amount",
        description: "Minimum deposit amount is ₦100.",
        variant: "destructive",
      });
      return;
    }

    // Initialize Paystack payment
    setProcessingPayment(true);
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount * 100, // Convert to kobo (Paystack uses smallest currency unit)
          email: user.email,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // Open Paystack checkout
      if (data.authorization_url && typeof window !== 'undefined') {
        window.location.href = data.authorization_url;
      } else {
        throw new Error('Payment URL not received');
      }
    } catch (error) {
      console.error("Error initializing payment:", error);
      toast({
        title: "Payment error",
        description: error instanceof Error ? error.message : "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Loading wallet...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Please log in to view wallet</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Wallet</h1>
          <p className="text-xs md:text-base text-muted-foreground">Manage your funds and transactions</p>
        </div>

        <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-lg p-3 md:p-6 mb-3 md:mb-6">
          <p className="text-[10px] md:text-sm opacity-90 mb-1 md:mb-2">Current Balance</p>
          <h2 className="text-lg md:text-4xl font-bold mb-1.5 md:mb-4">{formatCurrency(profile?.balance || 0, currency)}</h2>
          <p className="text-[9px] md:text-sm opacity-75 break-all leading-tight">User: {user.email}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 md:p-5 mb-3 md:mb-6">
          <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-3">Add Funds</h3>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow only positive numbers
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setDepositAmount(value);
                  }
                }}
                placeholder="Enter amount (minimum ₦100)"
                className="flex-1 px-3 md:px-4 py-2 md:py-2.5 border border-input rounded-lg md:rounded-md bg-background text-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                min="100"
                step="0.01"
                disabled={processingPayment}
              />
              <button
                onClick={handleDeposit}
                disabled={processingPayment || !depositAmount.trim()}
                className="px-4 md:px-6 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-lg md:rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation text-sm md:text-base whitespace-nowrap flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Deposit'
                )}
              </button>
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Minimum deposit: ₦100. Secure payment powered by Paystack.
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 md:p-5">
          <h3 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">Transaction History</h3>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {transactions.map((trans) => (
                <div
                  key={trans.id}
                  className="flex justify-between items-center pb-2 md:pb-3 border-b border-border last:border-b-0"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-medium capitalize text-foreground text-xs md:text-sm truncate">
                      {trans.type.replace("_", " ")}
                    </p>
                    <p className="text-[10px] md:text-sm text-muted-foreground">
                      {format(new Date(trans.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <p
                    className={`font-semibold text-xs md:text-base whitespace-nowrap ${
                      trans.amount > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {trans.amount > 0 ? "+" : ""}
                    {formatCurrency(Math.abs(trans.amount), currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
