"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { useUserCurrency } from "@/hooks/use-user-currency";
import { Send, ArrowDownCircle, ArrowUpCircle, Smartphone, Wallet as WalletIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceCard } from "@/components/wallet/balance-card";
import { DepositTab } from "@/components/wallet/deposit-tab";
import { WithdrawTab } from "@/components/wallet/withdraw-tab";
import { TransferTab } from "@/components/wallet/transfer-tab";
import { BillsTab } from "@/components/wallet/bills-tab";
import { TransactionHistory } from "@/components/wallet/transaction-history";
import { useSettings } from "@/hooks/use-settings";
import type { KycSummary } from "@/lib/kyc/types";
import { logger } from "@/lib/logger";

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
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; username: string; email?: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw" | "transfer" | "bills">("deposit");
  const [kycSummary, setKycSummary] = useState<KycSummary | null>(null);
  const [kycLoading, setKycLoading] = useState(true);
  const { toast } = useToast();
  const { currency: userCurrency } = useUserCurrency();
  const currency = (userCurrency.code || DEFAULT_CURRENCY) as Currency;
  const { getSetting } = useSettings();
  const minDeposit = getSetting('payments.min_deposit', 100) as number;
  const maxDeposit = getSetting('payments.max_deposit', undefined) as number | undefined;
  const minWithdrawal = getSetting('payments.min_withdrawal', 100) as number;
  const maxWithdrawal = getSetting('payments.max_withdrawal', undefined) as number | undefined;

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWalletData = useCallback(async (force = false) => {
    if (!user) return;

    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;

    // Always fetch fresh data from API (no cache)
    try {
      // Only show loading on initial load or explicit force refresh
      if (force || !profile) {
        setLoading(true);
      }
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
      logger.error("Error fetching wallet data", error);
    } finally {
      // Only hide loading on initial load or explicit force refresh
      if (force || !profile) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [user, profile]);

  // Debounced refetch function for subscriptions
  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchWalletData(true);
    }, 2000); // Increased debounce to 2 seconds
  }, [fetchWalletData]);

  const fetchKycSummary = useCallback(async () => {
    if (!user) return;
    try {
      setKycLoading(true);
      const { kycApi } = await import('@/lib/api-client');
      const response = await kycApi.get();
      setKycSummary(response.summary);
    } catch (error) {
      logger.error("Error fetching KYC summary", error);
    } finally {
      setKycLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchWalletData();
      fetchBanks();
      fetchKycSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user, not fetchWalletData to prevent re-renders

  const banksFetchedRef = useRef(false);

  const fetchBanks = useCallback(async () => {
    // Only fetch banks once per session
    if (banksFetchedRef.current) return;
    
    setLoadingBanks(true);
    try {
      // Fetch banks from Next.js API route (which proxies to backend)
      const response = await fetch('/api/payments/banks');
      const data = await response.json();
      if (data.success && data.banks) {
        // Remove duplicates by bank code (in case Paystack returns duplicates)
        const bankMap = new Map<string, { code: string; name: string }>();
        data.banks.forEach((bank: { code: string; name: string }) => {
          if (!bankMap.has(bank.code)) {
            bankMap.set(bank.code, bank);
          }
        });
        const uniqueBanks = Array.from(bankMap.values());
        // Sort alphabetically by name
        uniqueBanks.sort((a, b) => a.name.localeCompare(b.name));
        setBanks(uniqueBanks);
        banksFetchedRef.current = true;
      }
    } catch (error) {
      logger.error('Error fetching banks', error);
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
          // Extract error message from error object
          const errorMessage = typeof data.error === 'string' 
            ? data.error 
            : (data.error?.message || String(data.error || ''));
          
          // Only show error toast for non-account-related errors
          // Invalid account numbers are expected and shouldn't show error toasts
          if (errorMessage && !errorMessage.toLowerCase().includes('account') && !errorMessage.toLowerCase().includes('resolve') && !errorMessage.toLowerCase().includes('not found')) {
            toast({
              title: "Verification failed",
              description: errorMessage || 'Could not verify account. Please check the details and try again.',
              variant: "destructive",
            });
          }
        }
        setAccountName('');
        lastVerifiedRef.current = null;
        return;
      }
      
      if (data.success && data.data?.accountName) {
        setAccountName(data.data.accountName);
        // Remember this successful verification
        lastVerifiedRef.current = { accountNumber, bankCode };
      } else {
        setAccountName('');
        lastVerifiedRef.current = null;
      }
    } catch (error) {
      logger.error('Error verifying account', error);
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
        description: `${formatCurrency(parseFloat(amount), currency, userCurrency.symbol)} has been added to your wallet.`,
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

  // Listen for balance update events (event-driven, no polling)
  useEffect(() => {
    if (!user) return;

    // Listen for custom balance update events
    const handleBalanceUpdate = () => {
      debouncedRefetch();
    };
    window.addEventListener('balance-updated', handleBalanceUpdate);
    window.addEventListener('wager-updated', handleBalanceUpdate);

    return () => {
      window.removeEventListener('balance-updated', handleBalanceUpdate);
      window.removeEventListener('wager-updated', handleBalanceUpdate);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [user, debouncedRefetch]);

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

    if (maxWithdrawal && amount > maxWithdrawal) {
      toast({
        title: `Maximum withdrawal is ₦${maxWithdrawal.toLocaleString()}`,
        description: `You can withdraw up to ₦${maxWithdrawal.toLocaleString()} per transaction.`,
        variant: "destructive",
      });
      return;
    }

    // Frontend validation - check balance
    if (!profile || profile.balance < amount) {
      toast({
        title: "Insufficient balance",
        description: `Your balance is ₦${(profile?.balance || 0).toLocaleString()}. You need ₦${amount.toLocaleString()} to withdraw.`,
        variant: "destructive",
      });
      return;
    }

    // Frontend validation - check account details
    if (!accountNumber || accountNumber.length !== 10) {
      toast({
        title: "Invalid account number",
        description: "Please enter a valid 10-digit account number.",
        variant: "destructive",
      });
      return;
    }

    if (!bankCode) {
      toast({
        title: "Bank selection required",
        description: "Please select a bank from the list.",
        variant: "destructive",
      });
      return;
    }

    if (!accountName) {
      toast({
        title: "Account verification needed",
        description: "Please wait for account verification to complete.",
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
          description: `We've received your request for ${formatCurrency(amount, currency, userCurrency.symbol)}. It should be in your bank account soon.`,
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
      logger.error("Error processing withdrawal", error);
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
        title: "Insufficient balance",
        description: `Your balance is ₦${(profile?.balance || 0).toLocaleString()}. You need ₦${roundedAmount.toLocaleString()} to transfer.`,
        variant: "destructive",
      });
      return;
    }

    // Check daily transfer cap if KYC info is available
    if (kycSummary?.limits?.dailyTransferCap && roundedAmount > kycSummary.limits.dailyTransferCap) {
      toast({
        title: "Transfer limit exceeded",
        description: `Amount exceeds your daily transfer cap of ₦${kycSummary.limits.dailyTransferCap.toLocaleString()}.`,
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
        // Extract error message directly from the data object
        let errorMessage = 'Failed to process transfer';
        
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (typeof data.error === 'object' && data.error !== null) {
            // Use the specific error message from the backend
            errorMessage = data.error.message || errorMessage;
          }
        } else if (data.message) {
          errorMessage = data.message;
        }
        
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
          description: `${formatCurrency(roundedAmount, currency, userCurrency.symbol)} has been sent to @${selectedRecipient.username}`,
        });

        // Reset form
        setTransferUsername("");
        setTransferAmount("");
        setTransferDescription("");
        setSelectedRecipient(null);
        
        // Refresh wallet data
        fetchWalletData(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('balance-updated'));
        }
      } else {
        toast({
          title: "Transfer failed",
          description: data.error || data.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      logger.error("Error processing transfer", error);
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

    if (amount < minDeposit) {
      toast({
        title: `Minimum deposit is ₦${minDeposit}`,
        description: `You need to deposit at least ₦${minDeposit}.`,
        variant: "destructive",
      });
      return;
    }

    if (maxDeposit && amount > maxDeposit) {
      toast({
        title: `Maximum deposit is ₦${maxDeposit.toLocaleString()}`,
        description: `You can deposit up to ₦${maxDeposit.toLocaleString()} per transaction.`,
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
          amount: amount, // Amount in main currency (NGN), backend will convert to kobo
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
        logger.error('Payment response data', { data, expectedPath: 'data.data.authorization_url' });
        throw new Error('Payment URL not received from server. Please try again.');
      }
      
      if (typeof window !== 'undefined') {
        window.location.href = authUrl;
      }
    } catch (error) {
      logger.error("Error initializing payment", error);
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
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="space-y-6">
            <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
            <div className="h-64 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <WalletIcon className="h-16 w-16 mx-auto text-muted-foreground/50" />
            <h2 className="text-xl sm:text-2xl font-semibold">Please log in</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              You need to be logged in to view your wallet
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Enhanced Header with Balance */}
        <div className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">Wallet</h1>
              <p className="text-sm text-muted-foreground">Manage your funds and transactions</p>
            </div>
            {profile && (
              <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background dark:from-primary/20 dark:via-primary/10 dark:to-background border-primary/20">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Available Balance</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground break-words">
                        {formatCurrency(profile.balance, currency, userCurrency.symbol)}
                      </p>
                    </div>
                    <div className="ml-4 p-3 sm:p-4 rounded-full bg-primary/10 dark:bg-primary/20 flex-shrink-0">
                      <WalletIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Enhanced Actions Tabs */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "deposit" | "withdraw" | "transfer" | "bills")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 h-auto p-1 bg-muted/50 gap-1">
                <TabsTrigger 
                  value="deposit" 
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-2.5 px-3 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all min-h-[60px] sm:min-h-[44px] touch-manipulation"
                >
                  <ArrowDownCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span className="font-medium">Deposit</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="withdraw" 
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-2.5 px-3 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all min-h-[60px] sm:min-h-[44px] touch-manipulation"
                >
                  <ArrowUpCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span className="font-medium">Withdraw</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="transfer" 
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-2.5 px-3 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all min-h-[60px] sm:min-h-[44px] touch-manipulation"
                >
                  <Send className="h-4 w-4 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span className="font-medium hidden sm:inline">Transfer</span>
                  <span className="font-medium sm:hidden">Send</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="bills" 
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-2.5 px-3 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all min-h-[60px] sm:min-h-[44px] touch-manipulation"
                >
                  <Smartphone className="h-4 w-4 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span className="font-medium">Bills</span>
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
                  maxDeposit={maxDeposit}
                  currencySymbol={userCurrency.symbol}
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
                  minWithdrawal={minWithdrawal}
                  maxWithdrawal={maxWithdrawal}
                  currencySymbol={userCurrency.symbol}
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
                  currencySymbol={userCurrency.symbol}
                  onTransfer={handleTransfer}
                  kycSummary={kycSummary}
                  kycLoading={kycLoading}
                />
              </TabsContent>

              {/* Bills Payment Tab */}
              <TabsContent value="bills" className="mt-0">
                <BillsTab
                  balance={profile?.balance || 0}
                  currency={currency}
                  currencySymbol={userCurrency.symbol}
                  onPurchase={async (payload) => {
                    const endpoint =
                      payload.category === 'data' ? '/api/bills/data' : '/api/bills/airtime';

                    try {
                      const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });

                      const data = await response.json();

                      if (!response.ok || !data?.success) {
                        const errorMessage =
                          data?.error?.message || `Failed to process ${payload.category} purchase`;
                        throw new Error(errorMessage);
                      }

                      const description =
                        payload.category === 'data'
                          ? data.data?.message ||
                            `${payload.dataPlanLabel || payload.dataPlanCode} for ${
                              payload.networkName || 'network'
                            } initiated`
                          : data.data?.message ||
                            `${userCurrency.symbol}${payload.amount.toLocaleString()} purchase for ${
                              payload.networkName || 'network'
                            } initiated`;

                      toast({
                        title: payload.category === 'data' ? 'Data request submitted' : 'Airtime request submitted',
                        description,
                      });

                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('balance-updated'));
                      }

                      await fetchWalletData(true);
                    } catch (error) {
                      const { extractErrorMessage } = await import('@/lib/error-extractor');
                      const message = extractErrorMessage(
                        error,
                        "We couldn't complete this purchase. Please try again.",
                      );
                      toast({
                        title: "Purchase failed",
                        description: message,
                        variant: "destructive",
                      });
                      throw error;
                    }
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <TransactionHistory transactions={transactions} currency={currency} currencySymbol={userCurrency.symbol} />
      </div>
    </main>
  );
}

export default function Wallet() {
  return (
    <Suspense fallback={
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="space-y-6">
            <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
            <div className="h-64 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
      </main>
    }>
      <WalletContent />
    </Suspense>
  );
}
