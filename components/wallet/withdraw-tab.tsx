"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ArrowUpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Bank {
  code: string;
  name: string;
}

interface WithdrawTabProps {
  withdrawAmount: string;
  setWithdrawAmount: (amount: string) => void;
  accountNumber: string;
  setAccountNumber: (accountNumber: string) => void;
  bankCode: string;
  setBankCode: (bankCode: string) => void;
  accountName: string;
  banks: Bank[];
  loadingBanks: boolean;
  verifyingAccount: boolean;
  processingWithdrawal: boolean;
  balance: number;
  onWithdraw: () => void;
  onVerifyAccount: (accountNumber: string, bankCode: string) => Promise<void>;
  onLoadBanks: () => void;
  minWithdrawal: number;
  maxWithdrawal?: number;
  currencySymbol?: string;
}

export function WithdrawTab({
  withdrawAmount,
  setWithdrawAmount,
  accountNumber,
  setAccountNumber,
  bankCode,
  setBankCode,
  accountName,
  banks,
  loadingBanks,
  verifyingAccount,
  processingWithdrawal,
  balance,
  onWithdraw,
  onVerifyAccount,
  onLoadBanks,
  minWithdrawal,
  maxWithdrawal,
  currencySymbol = '₦',
}: WithdrawTabProps) {
  const verifyingAccountRef = useRef(false);
  const lastVerifiedRef = useRef<{ accountNumber: string; bankCode: string } | null>(null);

  useEffect(() => {
    onLoadBanks();
  }, [onLoadBanks]);

  useEffect(() => {
    if (!accountNumber || !bankCode || accountNumber.length !== 10) {
      return;
    }

    if (lastVerifiedRef.current?.accountNumber === accountNumber && lastVerifiedRef.current?.bankCode === bankCode) {
      return;
    }

    if (processingWithdrawal) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!verifyingAccountRef.current && !processingWithdrawal) {
        verifyingAccountRef.current = true;
        onVerifyAccount(accountNumber, bankCode).finally(() => {
          verifyingAccountRef.current = false;
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [accountNumber, bankCode, processingWithdrawal, onVerifyAccount]);

  // Frontend validation
  const amount = parseFloat(withdrawAmount) || 0;
  const amountError = (() => {
    if (!withdrawAmount.trim()) return null;
    if (isNaN(amount) || amount <= 0) return 'Please enter a valid amount';
    if (amount < minWithdrawal) return `Minimum withdrawal is ${currencySymbol}${minWithdrawal.toLocaleString()}`;
    if (maxWithdrawal && amount > maxWithdrawal) return `Maximum withdrawal is ${currencySymbol}${maxWithdrawal.toLocaleString()}`;
    if (amount > balance) return 'Insufficient balance';
    return null;
  })();

  const canWithdraw = !amountError && 
    withdrawAmount.trim() && 
    accountNumber.length === 10 && 
    bankCode && 
    accountName &&
    amount <= balance &&
    amount >= minWithdrawal &&
    (!maxWithdrawal || amount <= maxWithdrawal);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <label className="text-sm sm:text-base font-semibold mb-2 block text-foreground">
          Amount to Withdraw
        </label>
        <div className="relative">
          <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm sm:text-base">
            {currencySymbol}
          </span>
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                setWithdrawAmount(value);
              }
            }}
            placeholder={maxWithdrawal ? `${minWithdrawal.toLocaleString()} - ${maxWithdrawal.toLocaleString()}` : `Minimum ${minWithdrawal.toLocaleString()}`}
            className={`w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-3.5 border rounded-lg bg-background text-foreground text-base sm:text-lg focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${
              amountError 
                ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500' 
                : 'border-input focus:ring-primary/50 focus:border-primary'
            }`}
            min={minWithdrawal}
            max={maxWithdrawal}
            step="0.01"
            disabled={processingWithdrawal}
            inputMode="decimal"
          />
        </div>
        {amountError && (
          <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1.5">
            <span className="text-red-500">•</span>
            {amountError}
          </p>
        )}
        {withdrawAmount.trim() && !amountError && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Available balance: <span className="font-semibold text-foreground">{currencySymbol}{balance.toLocaleString()}</span>
          </p>
        )}
      </div>
      <div>
        <label className="text-sm sm:text-base font-semibold mb-2 block text-foreground">
          Select Bank
        </label>
        <Select value={bankCode} onValueChange={setBankCode} disabled={loadingBanks || processingWithdrawal}>
          <SelectTrigger className="w-full h-12 sm:h-14 text-base sm:text-lg border-input rounded-lg touch-manipulation">
            <SelectValue placeholder={loadingBanks ? "Loading banks..." : "Choose your bank"} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {banks.map((bank) => (
              <SelectItem key={bank.code} value={bank.code} className="text-base sm:text-lg py-3 touch-manipulation">
                {bank.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm sm:text-base font-semibold mb-2 block text-foreground">
          Account Number
        </label>
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
            setAccountNumber(value);
          }}
          placeholder="Enter 10-digit account number"
          className="w-full px-3 sm:px-4 py-3 sm:py-3.5 border border-input rounded-lg bg-background text-foreground text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          maxLength={10}
          disabled={processingWithdrawal}
          inputMode="numeric"
        />
        {verifyingAccount && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verifying account...
          </p>
        )}
        {accountName && accountNumber.length === 10 && !verifyingAccount && (
          <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-2 font-semibold flex items-center gap-2 bg-green-50 dark:bg-green-950/20 px-3 py-2 rounded-md border border-green-200 dark:border-green-800">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>{accountName}</span>
          </p>
        )}
      </div>
      <button
        onClick={onWithdraw}
        disabled={processingWithdrawal || !canWithdraw}
        className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 min-h-[52px] sm:min-h-[56px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-base sm:text-lg shadow-sm hover:shadow-md"
      >
        {processingWithdrawal ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <ArrowUpCircle className="h-5 w-5" />
            <span>Withdraw Funds</span>
          </>
        )}
      </button>
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs sm:text-sm text-muted-foreground text-center leading-relaxed">
          {maxWithdrawal ? (
            <>Withdrawal range: {currencySymbol}{minWithdrawal.toLocaleString()} - {currencySymbol}{maxWithdrawal.toLocaleString()}<br className="sm:hidden" /> <span className="hidden sm:inline">•</span> Funds will be transferred to your bank account</>
          ) : (
            <>Minimum withdrawal: {currencySymbol}{minWithdrawal.toLocaleString()}<br className="sm:hidden" /> <span className="hidden sm:inline">•</span> Funds will be transferred to your bank account</>
          )}
        </p>
      </div>
    </div>
  );
}

