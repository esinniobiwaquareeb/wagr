"use client";

import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { UsernameInput } from "@/components/username-input";
import { formatCurrency, type Currency } from "@/lib/currency";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { KycSummary } from "@/lib/kyc/types";

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
  const kycLevel = kycSummary?.currentLevel ?? 1;
  const limits = kycSummary?.limits;
  const level2Min = limits?.level2MinTransfer ?? 2000;
  const level2Max = limits?.level2MaxTransfer ?? 50000;
  const level3Max = limits?.level3MaxTransfer ?? 500000;
  const canTransfer = kycLevel >= 2 || Boolean(limits?.level1TransferEnabled);
  const limitCopy =
    kycLevel >= 3
      ? `Transfers up to ₦${level3Max.toLocaleString()}`
      : `Transfers between ₦${level2Min.toLocaleString()} and ₦${level2Max.toLocaleString()}`;
  const transferDisabledReason = canTransfer
    ? ''
    : 'Complete Level 2 verification to unlock wallet transfers.';
  const minTransferAmount = kycLevel === 2 ? level2Min : 1;
  const maxTransferAmount = kycLevel === 2 ? level2Max : level3Max;

  return (
    <div className="space-y-3">
      {!kycLoading && (
        <Alert variant={canTransfer ? "default" : "destructive"}>
          <AlertTitle>{canTransfer ? "Verification ready" : "Transfers locked"}</AlertTitle>
          <AlertDescription className="text-xs">
            {canTransfer ? (
              limitCopy
            ) : (
              <>
                You need to finish <strong>Level 2 KYC</strong> before sending funds.
                <Link href="/profile#kyc" className="underline ml-1">Update profile</Link>
              </>
            )}
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
          {canTransfer && maxTransferAmount && (
            <> • Limit: ₦{minTransferAmount.toLocaleString()} - ₦{maxTransferAmount.toLocaleString()}</>
          )}
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
          !selectedRecipient ||
          !canTransfer
        }
        title={!canTransfer ? transferDisabledReason : undefined}
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
      {!canTransfer && (
        <p className="text-[11px] text-center text-muted-foreground">
          <Link href="/profile#kyc" className="underline">Verify your identity</Link> to enable transfers.
        </p>
      )}
    </div>
  );
}

