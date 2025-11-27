"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Send, ArrowDownCircle, ArrowUpCircle, Smartphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceCard } from "@/components/wallet/balance-card";
import { DepositTab } from "@/components/wallet/deposit-tab";
import { WithdrawTab } from "@/components/wallet/withdraw-tab";
import { TransferTab } from "@/components/wallet/transfer-tab";
import { BillsTab } from "@/components/wallet/bills-tab";
import { TransactionHistory } from "@/components/wallet/transaction-history";
import { useSettings } from "@/hooks/use-settings";

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
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth({
    requireAuth: false, // Don't auto-redirect, we'll handle it manually after checking payment callback
  });
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
  const verifyingAccountRef = useRef(false);
  const lastVerifiedRef = useRef<{ accountNumber: string; bankCode: string } | null>(null);
  const [transferUsername, setTransferUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [processingTransfer, setProcessingTransfer] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; username: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw" | "transfer" | "bills">("deposit");
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;
  const { getSetting } = useSettings();
  const minDeposit = getSetting('payments.min_deposit', 100) as number;
  const minWithdrawal = getSetting('payments.min_withdrawal', 100) as number;

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWalletData = useCallback(async (force = false) => {
    if (!user) return;

    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;

    // Always fetch fresh data from API (no cache)
    try {
      setLoading(true);
      const { walletApi } = await import('@/lib/api-client');
      
      // Fetch balance and transactions in parallel
      const [balanceResponse, transactionsResponse] = await Promise.all([
        walletApi.getBalance(),
        walletApi.getTransactions({ limit: 5 }), // Only fetch 5 for wallet page preview
      ]);

      // Update profile with balance
      const profileData = { balance: balanceResponse.balance };
      setProfile(profileData);

      // Update transactions
      // API returns { transactions: [...], meta: {...} }
      const transData = transactionsResponse?.transactions || [];
      setTransactions(transData);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user]);

  // Debounced refetch function for subscriptions
  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchWalletData(true);
    }, 2000); // Increased debounce to 2 seconds
  }, [fetchWalletData]);

  useEffect(() => {
    if (user) {
      fetchWalletData();
      fetchBanks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user, not fetchWalletData to prevent re-renders

  const banksFetchedRef = useRef(false);

  const fetchBanks = useCallback(async () => {
    // Only fetch banks once per session
    if (banksFetchedRef.current) return;
    
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
        // Deduplication is handled by the Map above
        setBanks(uniqueBanks);
        banksFetchedRef.current = true;
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
    if (verifyingAccountRef.current) {
      return;
    }

    // Don't verify if processing withdrawal
    if (processingWithdrawal) {
      return;
    }

    // Check if we already verified this exact account
    if (lastVerifiedRef.current?.accountNumber === accountNumber && lastVerifiedRef.current?.bankCode === bankCode) {
      return;
    }

    verifyingAccountRef.current = true;
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
          
          // Only show toast if we have a meaningful message
          if (errorMessage && errorMessage.trim()) {
            toast({
              title: "Verification limit reached",
              description: errorMessage,
              variant: "destructive",
            });
          }
        } else if (data.error) {
          const errorText = typeof data.error === 'string' ? data.error : String(data.error || '');
          // Only show error toast for non-account-related errors
          // Invalid account numbers are expected and shouldn't show error toasts
          if (errorText && !errorText.toLowerCase().includes('account') && !errorText.toLowerCase().includes('resolve') && !errorText.toLowerCase().includes('not found')) {
            toast({
              title: "Verification failed",
              description: errorText || 'Could not verify account. Please check the details and try again.',
              variant: "destructive",
            });
          }
        }
        setAccountName('');
        lastVerifiedRef.current = null;
        return;
      }
      
      if (data.success && data.accountName) {
        setAccountName(data.accountName);
        // Remember this successful verification
        lastVerifiedRef.current = { accountNumber, bankCode };
      } else {
        setAccountName('');
        lastVerifiedRef.current = null;
      }
    } catch (error) {
      console.error('Error verifying account:', error);
      setAccountName('');
      lastVerifiedRef.current = null;
      // Don't show toast for network errors during verification - it's too noisy
    } finally {
      verifyingAccountRef.current = false;
      setVerifyingAccount(false);
    }
  }, [toast, processingWithdrawal]);

  useEffect(() => {
    // Clear account name if account number or bank code is invalid
    if (!accountNumber || !bankCode || accountNumber.length !== 10) {
      setAccountName('');
      lastVerifiedRef.current = null;
      return;
    }

    // Don't verify if already verified for this exact account
    if (lastVerifiedRef.current?.accountNumber === accountNumber && lastVerifiedRef.current?.bankCode === bankCode) {
      return;
    }

    // Don't verify if currently processing withdrawal (form might be resetting)
    if (processingWithdrawal) {
      return;
    }

    // Debounce verification to avoid rapid requests
    const timeoutId = setTimeout(() => {
      // Only verify if not currently verifying and not processing withdrawal
      if (!verifyingAccountRef.current && !processingWithdrawal) {
        verifyAccount(accountNumber, bankCode);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [accountNumber, bankCode, verifyAccount, processingWithdrawal]);

  // Handle payment callback from Paystack
  useEffect(() => {
    if (authLoading) return;

    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const amount = searchParams.get('amount');

    if (!success && !error) {
      setProcessingPayment(false);
      return;
    }

    // Refresh auth after Paystack redirect to restore session
    setTimeout(() => refreshAuth(), 100);

    if (success === 'true' && amount) {
      setProcessingPayment(false);
      toast({
        title: "Money added!",
        description: `${formatCurrency(parseFloat(amount), currency)} has been added to your wallet.`,
      });
      fetchWalletData(true);
      setTimeout(() => router.replace('/wallet'), 500);
    } else if (success === 'pending' && amount) {
      setProcessingPayment(false);
      toast({
        title: "Payment processing...",
        description: `Your payment of ${formatCurrency(parseFloat(amount), currency)} is being processed. Your balance will update shortly.`,
      });
      fetchWalletData(true);
      
      let pollCount = 0;
      const maxPolls = 15;
      const pollInterval = setInterval(() => {
        pollCount++;
        fetchWalletData(true);
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
        }
      }, 2000);
      
      setTimeout(() => router.replace('/wallet'), 100);
      
      return () => clearInterval(pollInterval);
    } else if (error) {
      setProcessingPayment(false);
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
      setTimeout(() => router.replace('/wallet'), 100);
    }
  }, [searchParams, toast, currency, router, fetchWalletData, authLoading, refreshAuth]);

  // Redirect to login if not authenticated (but not during payment callback)
  useEffect(() => {
    if (authLoading) return;

    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    // Don't redirect during payment callback
    if (success || error) return;

    if (!user) {
      router.push("/wagers?login=true");
    }
  }, [user, authLoading, searchParams, router]);

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
          debouncedRefetch();
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
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      profileChannel.unsubscribe();
      transactionsChannel.unsubscribe();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [user, supabase]); // Removed fetchWalletData and debouncedRefetch from dependencies

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

    if (amount < minWithdrawal) {
      toast({
        title: `Minimum withdrawal is ₦${minWithdrawal}`,
        description: `You need to withdraw at least ₦${minWithdrawal}.`,
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
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({
          amount: amount,
          accountNumber: accountNumber,
          bankCode: bankCode,
          accountName: accountName,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const { extractErrorFromResponse } = await import('@/lib/error-extractor');
        const errorMessage = await extractErrorFromResponse(response, 'Failed to process withdrawal');
        
        toast({
          title: "Withdrawal didn't work",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // Check if withdrawal was successful (new API format: data.data)
      if (data.success && data.data) {
        toast({
          title: "Withdrawal on the way!",
          description: `We've received your request for ${formatCurrency(amount, currency)}. It should be in your bank account soon.`,
        });

        // Reset form
        setWithdrawAmount("");
        setAccountNumber("");
        setBankCode("");
        setAccountName("");
        lastVerifiedRef.current = null;
        
        // Refresh wallet data
        fetchWalletData(true);
      } else {
        toast({
          title: "Withdrawal didn't work",
          description: data.error || data.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
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

  const handleTransfer = async () => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to transfer funds.",
        variant: "destructive",
      });
      return;
    }

    // Validate username
    const trimmedUsername = transferUsername.trim().replace('@', '');
    if (!trimmedUsername) {
      toast({
        title: "Who are you sending to?",
        description: "Enter the username of the person you want to send money to.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedRecipient) {
      toast({
        title: "Please select a user",
        description: "Select a user from the suggestions or enter a valid username.",
        variant: "destructive",
      });
      return;
    }

    // Validate amount
    const trimmedAmount = transferAmount.trim();
    if (!trimmedAmount) {
      toast({
        title: "How much to send?",
        description: "Enter the amount you want to transfer.",
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
        description: "You can only transfer amounts greater than ₦0.",
        variant: "destructive",
      });
      return;
    }

    if (amount < 1) {
      toast({
        title: "Minimum transfer is ₦1",
        description: "You need to transfer at least ₦1.",
        variant: "destructive",
      });
      return;
    }

    // Round to 2 decimal places to avoid floating point precision issues
    const roundedAmount = Math.round(amount * 100) / 100;

    // Check balance
    if (!profile || profile.balance < roundedAmount) {
      toast({
        title: "Not enough in your wallet",
        description: "You don't have enough money to transfer that amount.",
        variant: "destructive",
      });
      return;
    }

    // Process transfer
    setProcessingTransfer(true);
    try {
      const response = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: trimmedUsername,
          amount: roundedAmount,
          description: transferDescription.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const { extractErrorFromResponse } = await import('@/lib/error-extractor');
        const errorMessage = await extractErrorFromResponse(response, 'Failed to process transfer');
        
        toast({
          title: "Transfer failed",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // Success
      if (data.success && data.data) {
        toast({
          title: "Transfer successful!",
          description: `${formatCurrency(roundedAmount, currency)} has been sent to @${selectedRecipient.username}`,
        });

        // Reset form
        setTransferUsername("");
        setTransferAmount("");
        setTransferDescription("");
        setSelectedRecipient(null);
        
        // Refresh wallet data
        fetchWalletData(true);
      } else {
        toast({
          title: "Transfer failed",
          description: data.error || data.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error processing transfer:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Something went wrong. Please try again.");
      
      toast({
        title: "Transfer failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessingTransfer(false);
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
      if (!user) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to make a deposit.",
          variant: "destructive",
        });
        setProcessingPayment(false);
        return;
      }

      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
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

      // Check for API error format
      if (!data.success) {
        const errorMessage = data.error?.message || 'Failed to initialize payment';
        throw new Error(errorMessage);
      }

      // Open Paystack checkout (new API format: data.data.authorization_url)
      const authUrl = data.data?.authorization_url;
      if (!authUrl) {
        console.error('Payment response data:', data);
        console.error('Expected authorization_url in data.data.authorization_url');
        throw new Error('Payment URL not received from server. Please try again.');
      }
      
      if (typeof window !== 'undefined') {
        window.location.href = authUrl;
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
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground">Loading wallet...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground">Please log in to view wallet</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Compact Header with Balance */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold">Wallet</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Manage your funds</p>
            </div>
            {profile && (
              <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex-1 sm:flex-none sm:text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">Balance</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-foreground truncate sm:whitespace-normal">{formatCurrency(profile.balance, currency)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compact Actions Tabs */}
        <Card className="mb-4">
          <CardContent className="p-4 md:p-5">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "deposit" | "withdraw" | "transfer" | "bills")} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4 h-10 p-1 bg-muted/50">
                <TabsTrigger 
                  value="deposit" 
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                >
                  <ArrowDownCircle className="h-3.5 w-3.5" />
                  <span>Deposit</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="withdraw" 
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  <span>Withdraw</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="transfer" 
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Transfer</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="bills" 
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Bills</span>
                </TabsTrigger>
              </TabsList>

              {/* Deposit Tab */}
              <TabsContent value="deposit" className="mt-0">
                <DepositTab
                  depositAmount={depositAmount}
                  setDepositAmount={setDepositAmount}
                  processingPayment={processingPayment}
                  onDeposit={handleDeposit}
                  minDeposit={minDeposit}
                />
              </TabsContent>

              {/* Withdraw Tab */}
              <TabsContent value="withdraw" className="mt-0">
                <WithdrawTab
                  withdrawAmount={withdrawAmount}
                  setWithdrawAmount={setWithdrawAmount}
                  accountNumber={accountNumber}
                  setAccountNumber={setAccountNumber}
                  bankCode={bankCode}
                  setBankCode={setBankCode}
                  accountName={accountName}
                  banks={banks}
                  loadingBanks={loadingBanks}
                  verifyingAccount={verifyingAccount}
                  processingWithdrawal={processingWithdrawal}
                  balance={profile?.balance || 0}
                  onWithdraw={handleWithdraw}
                  onVerifyAccount={verifyAccount}
                  onLoadBanks={fetchBanks}
                />
              </TabsContent>

              {/* Transfer Tab */}
              <TabsContent value="transfer" className="mt-0">
                <TransferTab
                  transferUsername={transferUsername}
                  setTransferUsername={setTransferUsername}
                  transferAmount={transferAmount}
                  setTransferAmount={setTransferAmount}
                  transferDescription={transferDescription}
                  setTransferDescription={setTransferDescription}
                  selectedRecipient={selectedRecipient}
                  setSelectedRecipient={setSelectedRecipient}
                  processingTransfer={processingTransfer}
                  balance={profile?.balance || 0}
                  currency={currency}
                  onTransfer={handleTransfer}
                />
              </TabsContent>

              {/* Bills Payment Tab */}
              <TabsContent value="bills" className="mt-0">
                <BillsTab
                  balance={profile?.balance || 0}
                  currency={currency}
                  onPurchase={async (category, phoneNumber, amount) => {
                    // TODO: Integrate with bills payment API
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    toast({
                      title: "Purchase successful!",
                      description: `${category === 'airtime' ? 'Airtime' : category === 'data' ? 'Data' : 'Bill'} purchase completed`,
                    });
                    
                    // Refresh balance
                    await fetchWalletData(true);
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <TransactionHistory transactions={transactions} currency={currency} />
      </div>
    </main>
  );
}

export default function Wallet() {
  return (
    <Suspense fallback={
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground">Loading wallet...</p>
        </div>
      </main>
    }>
      <WalletContent />
    </Suspense>
  );
}
