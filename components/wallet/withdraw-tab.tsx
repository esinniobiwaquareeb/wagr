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
        <label className="text-sm font-medium mb-2 block">Amount</label>
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
          className="w-full px-4 py-2.5 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          min="100"
          step="0.01"
          disabled={processingWithdrawal}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Bank</label>
        <Select value={bankCode} onValueChange={setBankCode} disabled={loadingBanks || processingWithdrawal}>
          <SelectTrigger className="w-full">
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
        <label className="text-sm font-medium mb-2 block">Account Number</label>
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
            setAccountNumber(value);
          }}
          placeholder="Enter 10-digit account number"
          className="w-full px-4 py-2.5 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          maxLength={10}
          disabled={processingWithdrawal}
        />
        {verifyingAccount && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verifying account...
          </p>
        )}
        {accountName && accountNumber.length === 10 && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ {accountName}
          </p>
        )}
      </div>
      <button
        onClick={onWithdraw}
        disabled={processingWithdrawal || !withdrawAmount.trim() || !accountNumber || !bankCode || !accountName}
        className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
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
        Minimum withdrawal: ₦100. Funds will be transferred to your bank account.
      </p>
    </div>
  );
}

