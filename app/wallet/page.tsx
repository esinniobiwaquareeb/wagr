"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";

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
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
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
    if (!depositAmount || isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(depositAmount);

    // Add balance
    await supabase.rpc("increment_balance", {
      user_id: user.id,
      amt: amount,
    });

    // Add transaction
    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount: amount,
      reference: "manual_deposit",
    });

    setDepositAmount("");
    // Refresh profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    toast({
      title: "Success!",
      description: `Successfully deposited ${amount.toFixed(2)}.`,
    });
  };

  if (loading) {
    return (
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Loading wallet...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Please log in to view wallet</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Wallet</h1>
          <p className="text-muted-foreground">Manage your funds and transactions</p>
        </div>

        <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-lg p-5 md:p-6 mb-6">
          <p className="text-xs md:text-sm opacity-90 mb-2">Current Balance</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4">{formatCurrency(profile?.balance || 0, currency)}</h2>
          <p className="text-xs md:text-sm opacity-75 truncate">User: {user.email}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 md:p-5 mb-6">
          <h3 className="text-base md:text-lg font-semibold mb-3">Add Funds</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 px-4 py-3 md:px-3 md:py-2 border border-input rounded-lg md:rounded-md bg-background text-foreground text-base"
              min="1"
            />
            <button
              onClick={handleDeposit}
              className="px-6 py-3 md:px-4 md:py-2 bg-primary text-primary-foreground rounded-lg md:rounded-md font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation text-sm md:text-base whitespace-nowrap"
            >
              Deposit
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 md:p-5">
          <h3 className="text-base md:text-lg font-semibold mb-4">Transaction History</h3>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((trans) => (
                <div
                  key={trans.id}
                  className="flex justify-between items-center pb-3 border-b border-border last:border-b-0"
                >
                  <div>
                    <p className="font-medium capitalize text-foreground">
                      {trans.type.replace("_", " ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(trans.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <p
                    className={`font-semibold ${
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
