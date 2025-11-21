"use client";

import { Loader2, Send } from "lucide-react";
import { UsernameInput } from "@/components/username-input";
import { formatCurrency, type Currency } from "@/lib/currency";

interface User {
  id: string;
  username: string;
}

interface TransferTabProps {
  transferUsername: string;
  setTransferUsername: (username: string) => void;
  transferAmount: string;
  setTransferAmount: (amount: string) => void;
  transferDescription: string;
  setTransferDescription: (description: string) => void;
  selectedRecipient: { id: string; username: string } | null;
  setSelectedRecipient: (recipient: { id: string; username: string } | null) => void;
  processingTransfer: boolean;
  balance: number;
  currency: Currency;
  onTransfer: () => void;
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
}: TransferTabProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium mb-2 block">Recipient Username</label>
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
              setSelectedRecipient({ id: user.id, username: user.username });
            } else {
              setSelectedRecipient(null);
            }
          }}
          placeholder="Enter username (e.g., @username)"
          disabled={processingTransfer}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Amount</label>
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
          className="w-full px-4 py-2.5 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          min="1"
          step="0.01"
          disabled={processingTransfer}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Available: {formatCurrency(balance, currency)}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
        <input
          type="text"
          value={transferDescription}
          onChange={(e) => setTransferDescription(e.target.value)}
          placeholder="Add a note (optional)"
          className="w-full px-4 py-2.5 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          maxLength={200}
          disabled={processingTransfer}
        />
      </div>
      <button
        onClick={onTransfer}
        disabled={processingTransfer || !transferUsername.trim() || !transferAmount.trim() || !selectedRecipient}
        className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
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
        Minimum transfer: ₦1. Transfers are instant and cannot be reversed.
      </p>
    </div>
  );
}

