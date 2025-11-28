"use client";

import { useState } from "react";
import { Loader2, ArrowDownCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DepositTabProps {
  depositAmount: string;
  setDepositAmount: (amount: string) => void;
  processingPayment: boolean;
  onDeposit: () => void;
  minDeposit: number;
  maxDeposit?: number;
}

export function DepositTab({
  depositAmount,
  setDepositAmount,
  processingPayment,
  onDeposit,
  minDeposit,
  maxDeposit,
}: DepositTabProps) {
  // Frontend validation
  const amount = parseFloat(depositAmount) || 0;
  const amountError = (() => {
    if (!depositAmount.trim()) return null;
    if (isNaN(amount) || amount <= 0) return 'Please enter a valid amount';
    if (amount < minDeposit) return `Minimum deposit is ₦${minDeposit.toLocaleString()}`;
    if (maxDeposit && amount > maxDeposit) return `Maximum deposit is ₦${maxDeposit.toLocaleString()}`;
    return null;
  })();

  const canDeposit = !amountError && depositAmount.trim() && amount >= minDeposit && (!maxDeposit || amount <= maxDeposit);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium mb-1.5 block text-foreground">Amount</label>
        <input
          type="number"
          value={depositAmount}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
              setDepositAmount(value);
            }
          }}
          placeholder={maxDeposit ? `Enter amount (₦${minDeposit} - ₦${maxDeposit.toLocaleString()})` : `Enter amount (minimum ₦${minDeposit})`}
          className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            amountError 
              ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500' 
              : 'border-input focus:ring-primary/50 focus:border-primary/50'
          }`}
          min={minDeposit}
          max={maxDeposit}
          step="0.01"
          disabled={processingPayment}
        />
        {amountError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{amountError}</p>
        )}
      </div>
      <button
        onClick={onDeposit}
        disabled={processingPayment || !canDeposit}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
      >
        {processingPayment ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <ArrowDownCircle className="h-4 w-4" />
            Deposit Funds
          </>
        )}
      </button>
      <p className="text-xs text-muted-foreground text-center">
        {maxDeposit ? (
          <>Range: ₦{minDeposit} - ₦{maxDeposit.toLocaleString()} • Secure payment via Paystack</>
        ) : (
          <>Minimum: ₦{minDeposit} • Secure payment via Paystack</>
        )}
      </p>
    </div>
  );
}

