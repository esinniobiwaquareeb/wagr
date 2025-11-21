"use client";

import { useState } from "react";
import { Loader2, ArrowDownCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DepositTabProps {
  depositAmount: string;
  setDepositAmount: (amount: string) => void;
  processingPayment: boolean;
  onDeposit: () => void;
}

export function DepositTab({
  depositAmount,
  setDepositAmount,
  processingPayment,
  onDeposit,
}: DepositTabProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium mb-2 block">Amount</label>
        <input
          type="number"
          value={depositAmount}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
              setDepositAmount(value);
            }
          }}
          placeholder="Enter amount (minimum ₦100)"
          className="w-full px-4 py-2.5 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          min="100"
          step="0.01"
          disabled={processingPayment}
        />
      </div>
      <button
        onClick={onDeposit}
        disabled={processingPayment || !depositAmount.trim()}
        className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
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
        Minimum deposit: ₦100. Secure payment powered by Paystack.
      </p>
    </div>
  );
}

