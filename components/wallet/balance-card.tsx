"use client";

import { Wallet as WalletIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, type Currency } from "@/lib/currency";

interface BalanceCardProps {
  balance: number;
  currency: Currency;
}

export function BalanceCard({ balance, currency }: BalanceCardProps) {
  return (
    <Card className="mb-4 md:mb-6 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-primary/20">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs md:text-sm opacity-90 mb-1 md:mb-2">Current Balance</p>
            <h2 className="text-2xl md:text-4xl font-bold">{formatCurrency(balance, currency)}</h2>
          </div>
          <WalletIcon className="h-8 w-8 md:h-12 md:w-12 opacity-75" />
        </div>
      </CardContent>
    </Card>
  );
}

