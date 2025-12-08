"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { DepositTab } from "@/components/wallet/deposit-tab";
import { useSettings } from "@/hooks/use-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DepositModal({ open, onOpenChange, onSuccess }: DepositModalProps) {
  const [depositAmount, setDepositAmount] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const currency = DEFAULT_CURRENCY as Currency;
  const { getSetting } = useSettings();
  const minDeposit = getSetting('payments.min_deposit', 100) as number;

  const handleDeposit = async () => {
    const trimmedAmount = depositAmount.trim();
    if (!trimmedAmount) {
      toast({
        title: "How much to add?",
        description: "Enter the amount you want to add to your wallet.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(trimmedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "You can only deposit amounts greater than ₦0.",
        variant: "destructive",
      });
      return;
    }

    if (amount < minDeposit) {
      toast({
        title: `Minimum deposit is ₦${minDeposit}`,
        description: `You need to deposit at least ₦${minDeposit}.`,
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);
    try {
      const { getCurrentUser } = await import('@/lib/auth/client');
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to make a deposit.",
          variant: "destructive",
        });
        setProcessingPayment(false);
        return;
      }

      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: amount, // Amount in main currency (NGN), backend will convert to kobo
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const { extractErrorFromResponse } = await import('@/lib/error-extractor');
        const errorMessage = await extractErrorFromResponse(response, 'Failed to initialize payment');
        throw new Error(errorMessage);
      }

      if (!data.success) {
        const errorMessage = data.error?.message || 'Failed to initialize payment';
        throw new Error(errorMessage);
      }

      const authUrl = data.data?.authorization_url;
      if (!authUrl) {
        throw new Error('Payment URL not received from server. Please try again.');
      }

      // Redirect to Paystack payment page
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Deposit error:", error);
      const errorMessage = error?.message || "Failed to initiate deposit. Please try again.";
      toast({
        title: "Deposit failed",
        description: errorMessage,
        variant: "destructive",
      });
      setProcessingPayment(false);
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setDepositAmount("");
      setProcessingPayment(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Funds to Wallet</DialogTitle>
          <DialogDescription>
            Add money to your wallet to participate in wagers. Secure payment powered by Paystack.
          </DialogDescription>
        </DialogHeader>
        <DepositTab
          depositAmount={depositAmount}
          setDepositAmount={setDepositAmount}
          processingPayment={processingPayment}
          onDeposit={handleDeposit}
          minDeposit={minDeposit}
        />
      </DialogContent>
    </Dialog>
  );
}

