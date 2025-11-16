"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
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
  description?: string | null;
}

function WalletContent() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [banks, setBanks] = useState<Array<{ code: string; name: string }>>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;

  const fetchWalletData = useCallback(async (force = false) => {
    if (!user) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cachedProfile = cache.get<Profile>(CACHE_KEYS.USER_PROFILE(user.id));
      const cachedTransactions = cache.get<Transaction[]>(CACHE_KEYS.TRANSACTIONS(user.id));
      
      if (cachedProfile && cachedTransactions) {
        setProfile(cachedProfile);
        setTransactions(cachedTransactions);
        setLoading(false);
        
        // Check if cache is stale - refresh in background if needed
        const profileCacheEntry = cache.memoryCache.get(CACHE_KEYS.USER_PROFILE(user.id));
        const transCacheEntry = cache.memoryCache.get(CACHE_KEYS.TRANSACTIONS(user.id));
        
        const profileAge = profileCacheEntry ? Date.now() - profileCacheEntry.timestamp : Infinity;
        const transAge = transCacheEntry ? Date.now() - transCacheEntry.timestamp : Infinity;
        const staleThreshold = Math.min(CACHE_TTL.USER_PROFILE, CACHE_TTL.TRANSACTIONS) / 2;
        
        if (profileAge > staleThreshold || transAge > staleThreshold) {
          // Refresh in background
          fetchWalletData(true).catch(() => {});
        }
        return;
      }
    }

    // No cache or forced refresh - fetch from API
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
        .insert({ id: user.id, balance: 0 })
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
      
      // Cache the results
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      if (profileData) {
        cache.set(CACHE_KEYS.USER_PROFILE(user.id), profileData, CACHE_TTL.USER_PROFILE);
      }
      cache.set(CACHE_KEYS.TRANSACTIONS(user.id), transData, CACHE_TTL.TRANSACTIONS);
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
      fetchBanks();
    }
  }, [user, fetchWalletData]);

  const fetchBanks = useCallback(async () => {
    setLoadingBanks(true);
    try {
      const response = await fetch('/api/payments/banks');
      const data = await response.json();
      if (data.success && data.banks) {
        // Remove duplicates by bank code (in case Paystack returns duplicates)
        const bankMap = new Map<string, { code: string; name: string }>();
        data.banks.forEach((bank: { code: string; name: string }) => {
          // Use code as key, but also check if we should keep the first or last occurrence
          if (!bankMap.has(bank.code)) {
            bankMap.set(bank.code, bank);
          }
        });
        const uniqueBanks = Array.from(bankMap.values());
        // Sort alphabetically by name
        uniqueBanks.sort((a, b) => a.name.localeCompare(b.name));
        // Double-check for duplicates and log if found
        const codes = uniqueBanks.map(b => b.code);
        const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
        if (duplicates.length > 0) {
          console.warn('Duplicate bank codes found after deduplication:', duplicates);
        }
        setBanks(uniqueBanks);
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  const verifyAccount = useCallback(async (accountNumber: string, bankCode: string) => {
    if (!accountNumber || !bankCode) return;
    
    // Prevent multiple simultaneous verification requests
    if (verifyingAccount) {
      return;
    }

    setVerifyingAccount(true);
    try {
      const response = await fetch('/api/payments/verify-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountNumber, bankCode }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Handle rate limiting or other errors
        if (response.status === 429) {
          const { extractErrorFromResponse } = await import('@/lib/error-extractor');
          const errorMessage = await extractErrorFromResponse(response, 'Too many verification requests. Please wait a moment.');
          toast({
            title: "Verification limit reached",
            description: errorMessage,
            variant: "destructive",
          });
        } else if (data.error && !data.error.includes('account') && !data.error.includes('resolve')) {
          // Only show error toast for non-account-related errors
          // Invalid account numbers are expected and shouldn't show error toasts
          toast({
            title: "Verification failed",
            description: data.error || 'Could not verify account. Please check the details and try again.',
            variant: "destructive",
          });
        }
        setAccountName('');
        return;
      }
      
      if (data.success && data.accountName) {
        setAccountName(data.accountName);
      } else {
        setAccountName('');
      }
    } catch (error) {
      console.error('Error verifying account:', error);
      setAccountName('');
      // Don't show toast for network errors during verification - it's too noisy
    } finally {
      setVerifyingAccount(false);
    }
  }, [toast, verifyingAccount]);

  useEffect(() => {
    if (accountNumber && bankCode && accountNumber.length === 10 && !verifyingAccount) {
      // Increased debounce to 1000ms (1 second) to reduce rapid requests and prevent rate limiting
      const timeoutId = setTimeout(() => {
        verifyAccount(accountNumber, bankCode);
      }, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setAccountName('');
    }
  }, [accountNumber, bankCode, verifyAccount, verifyingAccount]);

  // Handle payment callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const amount = searchParams.get('amount');

    if (success === 'true' && amount) {
      toast({
        title: "Money added!",
        description: `${formatCurrency(parseFloat(amount), currency)} has been added to your wallet.`,
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
        title: "Payment didn't go through",
        description: errorMessages[error] || "Something went wrong with the payment. Please try again.",
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

  const handleWithdraw = async () => {
    // Validate amount
    const trimmedAmount = withdrawAmount.trim();
    if (!trimmedAmount) {
      toast({
        title: "How much to withdraw?",
        description: "Enter the amount you want to take out.",
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
        title: "Amount needs to be more than zero",
        description: "You can only withdraw amounts greater than ₦0.",
        variant: "destructive",
      });
      return;
    }

    if (amount < 100) {
      toast({
        title: "Minimum withdrawal is ₦100",
        description: "You need to withdraw at least ₦100.",
        variant: "destructive",
      });
      return;
    }

    if (!profile || profile.balance < amount) {
      toast({
        title: "Not enough in your wallet",
        description: "You don't have enough money to withdraw that amount.",
        variant: "destructive",
      });
      return;
    }

    if (!accountNumber || !bankCode || !accountName) {
      toast({
        title: "Bank details needed",
        description: "We need your bank account information to send the money.",
        variant: "destructive",
      });
      return;
    }

    // Process withdrawal
    setProcessingWithdrawal(true);
    try {
      const response = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          accountNumber: accountNumber,
          bankCode: bankCode,
          accountName: accountName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const { extractErrorFromResponse } = await import('@/lib/error-extractor');
        const errorMessage = await extractErrorFromResponse(response, 'Failed to process withdrawal');
        throw new Error(errorMessage);
      }

      toast({
        title: "Withdrawal on the way!",
        description: `We've received your request for ${formatCurrency(amount, currency)}. It should be in your bank account soon.`,
      });

      // Reset form
      setWithdrawAmount("");
      setAccountNumber("");
      setBankCode("");
      setAccountName("");
      
      // Refresh wallet data
      fetchWalletData(true);
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Something went wrong. Please try again.");
      
      toast({
        title: "Withdrawal didn't work",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessingWithdrawal(false);
    }
  };

  const handleDeposit = async () => {
    // Validate amount
    const trimmedAmount = depositAmount.trim();
    if (!trimmedAmount) {
      toast({
        title: "How much to add?",
        description: "Enter the amount you want to add to your wallet.",
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
        title: "Amount needs to be more than zero",
        description: "You can only deposit amounts greater than ₦0.",
        variant: "destructive",
      });
      return;
    }

    if (amount < 100) {
      toast({
        title: "Minimum deposit is ₦100",
        description: "You need to deposit at least ₦100.",
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
        const { extractErrorFromResponse } = await import('@/lib/error-extractor');
        const errorMessage = await extractErrorFromResponse(response, 'Failed to initialize payment');
        throw new Error(errorMessage);
      }

      // Open Paystack checkout
      if (data.authorization_url && typeof window !== 'undefined') {
        window.location.href = data.authorization_url;
      } else {
        throw new Error('Payment URL not received');
      }
    } catch (error) {
      console.error("Error initializing payment:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "We couldn't start the payment process. Please try again.");
      
      toast({
        title: "Payment setup failed",
        description: errorMessage,
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mb-3 md:mb-6">
          {/* Deposit Section */}
          <div className="bg-card border border-border rounded-lg p-3 md:p-5">
            <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-3">Add Funds</h3>
            <div className="space-y-2">
              <div className="flex flex-col gap-2">
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
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-input rounded-lg md:rounded-md bg-background text-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                  min="100"
                  step="0.01"
                  disabled={processingPayment}
                />
                <button
                  onClick={handleDeposit}
                  disabled={processingPayment || !depositAmount.trim()}
                  className="w-full px-4 md:px-6 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-lg md:rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation text-sm md:text-base flex items-center justify-center gap-2"
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

          {/* Withdrawal Section */}
          <div className="bg-card border border-border rounded-lg p-3 md:p-5">
            <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-3">Withdraw Funds</h3>
            <div className="space-y-2">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setWithdrawAmount(value);
                  }
                }}
                placeholder="Enter amount (minimum ₦100)"
                className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-input rounded-lg md:rounded-md bg-background text-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                min="100"
                step="0.01"
                disabled={processingWithdrawal}
              />
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-input rounded-lg md:rounded-md bg-background text-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={processingWithdrawal || loadingBanks}
              >
                <option value="">Select Bank</option>
                {banks.map((bank) => {
                  // Use a combination of code and name to ensure uniqueness
                  const uniqueKey = `${bank.code}-${bank.name}`;
                  return (
                    <option key={uniqueKey} value={bank.code}>
                      {bank.name}
                    </option>
                  );
                })}
              </select>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setAccountNumber(value);
                }}
                placeholder="Account Number (10 digits)"
                className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-input rounded-lg md:rounded-md bg-background text-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                maxLength={10}
                disabled={processingWithdrawal}
              />
              {accountName && (
                <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400">
                  Account Name: {accountName}
                </p>
              )}
              <button
                onClick={handleWithdraw}
                disabled={processingWithdrawal || verifyingAccount || !withdrawAmount.trim() || !accountNumber || !bankCode || !accountName}
                className="w-full px-4 md:px-6 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-lg md:rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation text-sm md:text-base flex items-center justify-center gap-2"
              >
                {processingWithdrawal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : verifyingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying Account...
                  </>
                ) : (
                  'Withdraw'
                )}
              </button>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Minimum withdrawal: ₦100. Funds will be transferred to your bank account.
              </p>
            </div>
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
                  className="flex justify-between items-start pb-2 md:pb-3 border-b border-border last:border-b-0 gap-2 md:gap-3"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-medium capitalize text-foreground text-xs md:text-sm">
                      {trans.type.replace("_", " ")}
                    </p>
                    {trans.description ? (
                      <>
                        <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {trans.description}
                        </p>
                        <p className="text-[9px] md:text-[10px] text-muted-foreground/70 mt-0.5">
                          {format(new Date(trans.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                        {format(new Date(trans.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                    )}
                  </div>
                  <p
                    className={`font-semibold text-xs md:text-base whitespace-nowrap flex-shrink-0 ${
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

export default function Wallet() {
  return (
    <Suspense fallback={
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Loading wallet...</p>
        </div>
      </main>
    }>
      <WalletContent />
    </Suspense>
  );
}
