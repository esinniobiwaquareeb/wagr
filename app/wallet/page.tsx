"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Loader2, Send, User, ArrowRight } from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { UsernameInput } from "@/components/username-input";

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
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;

  const fetchWalletData = useCallback(async (force = false) => {
    if (!user) return;

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
      
      if (transData.length > 0) {
        console.log('Fetched transactions:', transData.length);
      } else {
        console.log('No transactions found. Response:', transactionsResponse);
      }
      setTransactions(transData);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

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
        // Deduplication is handled by the Map above
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
      setTimeout(() => {
        fetchWalletData(true);
        router.replace('/wallet');
      }, 500);
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
          // Force refresh when balance changes (clear cache)
          fetchWalletData(true);
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
          // Force refresh when transactions change (clear cache)
          fetchWalletData(true);
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

        {/* Transfer Section */}
        <div className="bg-card border border-border rounded-lg p-3 md:p-5 mb-3 md:mb-6">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Send className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <h3 className="text-sm md:text-lg font-semibold">Transfer to User</h3>
          </div>
          <div className="space-y-2 md:space-y-3">
            <UsernameInput
              value={transferUsername}
              onChange={(value) => {
                setTransferUsername(value);
                // Clear selected recipient if user manually changes the input
                if (!value.startsWith('@') || value !== `@${selectedRecipient?.username}`) {
                  setSelectedRecipient(null);
                }
              }}
              onUserSelect={(user) => {
                if (user) {
                  setSelectedRecipient({ id: user.id, username: user.username });
                } else {
                  setSelectedRecipient(null);
                }
              }}
              placeholder="Enter username (e.g., @username)"
              disabled={processingTransfer}
            />
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                  setTransferAmount(value);
                }
              }}
              placeholder="Enter amount (minimum ₦1)"
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-input rounded-lg md:rounded-md bg-background text-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              min="1"
              step="0.01"
              disabled={processingTransfer}
            />
            <input
              type="text"
              value={transferDescription}
              onChange={(e) => setTransferDescription(e.target.value)}
              placeholder="Optional: Add a note (e.g., 'For winning the bet')"
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-input rounded-lg md:rounded-md bg-background text-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={100}
              disabled={processingTransfer}
            />
            <button
              onClick={handleTransfer}
              disabled={processingTransfer || !transferUsername.trim() || !transferAmount.trim() || !selectedRecipient}
              className="w-full px-4 md:px-6 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-lg md:rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation text-sm md:text-base flex items-center justify-center gap-2"
            >
              {processingTransfer ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Transfer
                </>
              )}
            </button>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Minimum transfer: ₦1. Transfers are instant and cannot be reversed.
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 md:p-5">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h3 className="text-sm md:text-lg font-semibold">Transaction History</h3>
            {transactions.length > 0 && (
              <Link
                href="/wallet/transactions"
                className="flex items-center gap-1 text-xs md:text-sm text-primary hover:text-primary/80 transition-colors"
              >
                View All
                <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
              </Link>
            )}
          </div>
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
                      {trans.type === 'transfer_out' ? 'Transfer Sent' : 
                       trans.type === 'transfer_in' ? 'Transfer Received' :
                       trans.type.replace(/_/g, " ")}
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
