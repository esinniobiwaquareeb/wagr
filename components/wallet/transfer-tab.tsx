"use client";

import { Loader2, Send } from "lucide-react";
import { UsernameInput } from "@/components/username-input";
import { formatCurrency, type Currency } from "@/lib/currency";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { KycSummary } from "@/lib/kyc/types";

interface User {
  id: string;
  username: string;
  email?: string | null;
}

interface TransferTabProps {
  transferUsername: string;
  setTransferUsername: (username: string) => void;
  transferAmount: string;
  setTransferAmount: (amount: string) => void;
  transferDescription: string;
  setTransferDescription: (description: string) => void;
  selectedRecipient: { id: string; username: string; email?: string | null } | null;
  setSelectedRecipient: (recipient: { id: string; username: string; email?: string | null } | null) => void;
  processingTransfer: boolean;
  balance: number;
  currency: Currency;
  onTransfer: () => void;
  kycSummary?: KycSummary | null;
  kycLoading?: boolean;
}

export function TransferTab({
  transferUsername,
  setTransferUsername,
  transferAmount,
  setTransferAmount,
  transferDescription,
  setTransferDescription,
  selectedRecipient,
  setSelectedRecipient,
  processingTransfer,
  balance,
  currency,
  onTransfer,
  kycSummary,
  kycLoading = false,
}: TransferTabProps) {
  const limits = kycSummary?.limits;
  const dailyCap = limits?.dailyTransferCap ?? 500000;
  const minTransferAmount = 1;
  const infoCopy = `Wallet transfers are instant and free. Daily cap: ₦${dailyCap.toLocaleString()}.`;

  return (
    <div className="space-y-3">
      {!kycLoading && (
        <Alert variant="default">
          <AlertTitle>Transfers enabled</AlertTitle>
          <AlertDescription className="text-xs">
            {infoCopy}
          </AlertDescription>
        </Alert>
      )}
      <div>
        <label className="text-xs font-medium mb-1.5 block text-foreground">Recipient Username</label>
        <UsernameInput
          value={transferUsername}
          onChange={(value) => {
            setTransferUsername(value);
            if (!value.startsWith('@') || value !== `@${selectedRecipient?.username}`) {
              setSelectedRecipient(null);
            }
          }}
          onUserSelect={(user: User | null) => {
            if (user) {
              setSelectedRecipient({ id: user.id, username: user.username, email: user.email });
            } else {
              setSelectedRecipient(null);
            }
          }}
          placeholder="Enter username (e.g., @username)"
          disabled={processingTransfer}
        />
      </div>
      <div>
        <label className="text-xs font-medium mb-1.5 block text-foreground">Amount</label>
        <input
          type="number"
          value={transferAmount}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
              setTransferAmount(value);
            }
          }}
          placeholder="Enter amount"
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          min={minTransferAmount}
          step="0.01"
          disabled={processingTransfer}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Available: <span className="font-medium">{formatCurrency(balance, currency)}</span>
          {dailyCap && <> • Daily cap: ₦{dailyCap.toLocaleString()}</>}
        </p>
      </div>
      <div>
        <label className="text-xs font-medium mb-1.5 block text-foreground">Description (Optional)</label>
        <input
          type="text"
          value={transferDescription}
          onChange={(e) => setTransferDescription(e.target.value)}
          placeholder="Add a note (optional)"
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          maxLength={200}
          disabled={processingTransfer}
        />
      </div>
      <button
        onClick={onTransfer}
        disabled={
          processingTransfer ||
          !transferUsername.trim() ||
          !transferAmount.trim() ||
          !selectedRecipient
        }
        title={undefined}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
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
      <p className="text-xs text-muted-foreground text-center">
        Minimum: ₦{minTransferAmount.toLocaleString()} • Instant • Cannot be reversed
      </p>
      {selectedRecipient && selectedRecipient.email && (
        <p className="text-[11px] text-center text-muted-foreground">
          Sending to {selectedRecipient.email}
        </p>
      )}
    </div>
  );
}

