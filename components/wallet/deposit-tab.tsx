"use client";

import { useState } from "react";
import { Loader2, ArrowDownCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DepositTabProps {
  depositAmount: string;
  setDepositAmount: (amount: string) => void;
  processingPayment: boolean;
  onDeposit: () => void;
  minDeposit?: number;
}

export function DepositTab({
  depositAmount,
  setDepositAmount,
  processingPayment,
  onDeposit,
  minDeposit = 100,
}: DepositTabProps) {
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
          placeholder={`Enter amount (minimum ₦${minDeposit})`}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          min={minDeposit}
          step="0.01"
          disabled={processingPayment}
        />
      </div>
      <button
        onClick={onDeposit}
        disabled={processingPayment || !depositAmount.trim()}
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
        Minimum: ₦{minDeposit} • Secure payment via Paystack
      </p>
    </div>
  );
}

