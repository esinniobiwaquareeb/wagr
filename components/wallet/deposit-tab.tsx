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
    <div className="space-y-4 sm:space-y-5">
      <div>
        <label className="text-sm sm:text-base font-semibold mb-2 block text-foreground">
          Amount to Deposit
        </label>
        <div className="relative">
          <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm sm:text-base">
            ₦
          </span>
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                setDepositAmount(value);
              }
            }}
            placeholder={maxDeposit ? `${minDeposit.toLocaleString()} - ${maxDeposit.toLocaleString()}` : `Minimum ${minDeposit.toLocaleString()}`}
            className={`w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-3.5 border rounded-lg bg-background text-foreground text-base sm:text-lg focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${
              amountError 
                ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500' 
                : 'border-input focus:ring-primary/50 focus:border-primary'
            }`}
            min={minDeposit}
            max={maxDeposit}
            step="0.01"
            disabled={processingPayment}
            inputMode="decimal"
          />
        </div>
        {amountError && (
          <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1.5">
            <span className="text-red-500">•</span>
            {amountError}
          </p>
        )}
        {!amountError && depositAmount && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            You'll be redirected to Paystack to complete the payment
          </p>
        )}
      </div>
      <button
        onClick={onDeposit}
        disabled={processingPayment || !canDeposit}
        className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 min-h-[52px] sm:min-h-[56px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-base sm:text-lg shadow-sm hover:shadow-md"
      >
        {processingPayment ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <ArrowDownCircle className="h-5 w-5" />
            <span>Deposit Funds</span>
          </>
        )}
      </button>
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs sm:text-sm text-muted-foreground text-center leading-relaxed">
          {maxDeposit ? (
            <>Deposit range: ₦{minDeposit.toLocaleString()} - ₦{maxDeposit.toLocaleString()}<br className="sm:hidden" /> <span className="hidden sm:inline">•</span> Secure payment via Paystack</>
          ) : (
            <>Minimum deposit: ₦{minDeposit.toLocaleString()}<br className="sm:hidden" /> <span className="hidden sm:inline">•</span> Secure payment via Paystack</>
          )}
        </p>
      </div>
    </div>
  );
}

