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

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium mb-1.5 block text-foreground">Amount</label>
        <input
          type="number"
          value={withdrawAmount}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
              setWithdrawAmount(value);
            }
          }}
          placeholder={maxWithdrawal ? `Enter amount (₦${minWithdrawal} - ₦${maxWithdrawal.toLocaleString()})` : `Enter amount (minimum ₦${minWithdrawal})`}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          min={minWithdrawal}
          max={maxWithdrawal}
          step="0.01"
          disabled={processingWithdrawal}
        />
      </div>
      <div>
        <label className="text-xs font-medium mb-1.5 block text-foreground">Bank</label>
        <Select value={bankCode} onValueChange={setBankCode} disabled={loadingBanks || processingWithdrawal}>
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder={loadingBanks ? "Loading banks..." : "Select bank"} />
          </SelectTrigger>
          <SelectContent>
            {banks.map((bank) => (
              <SelectItem key={bank.code} value={bank.code}>
                {bank.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium mb-1.5 block text-foreground">Account Number</label>
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
            setAccountNumber(value);
          }}
          placeholder="Enter 10-digit account number"
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          maxLength={10}
          disabled={processingWithdrawal}
        />
        {verifyingAccount && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verifying account...
          </p>
        )}
        {accountName && accountNumber.length === 10 && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 font-medium flex items-center gap-1.5">
            <span>✓</span>
            <span>{accountName}</span>
          </p>
        )}
      </div>
      <button
        onClick={onWithdraw}
        disabled={processingWithdrawal || !withdrawAmount.trim() || !accountNumber || !bankCode || !accountName}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
      >
        {processingWithdrawal ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <ArrowUpCircle className="h-4 w-4" />
            Withdraw Funds
          </>
        )}
      </button>
      <p className="text-xs text-muted-foreground text-center">
        {maxWithdrawal ? (
          <>Range: ₦{minWithdrawal} - ₦{maxWithdrawal.toLocaleString()} • Transferred to your bank account</>
        ) : (
          <>Minimum: ₦{minWithdrawal} • Transferred to your bank account</>
        )}
      </p>
    </div>
  );
}

