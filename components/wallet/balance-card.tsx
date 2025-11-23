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
    <Card className="mb-6 border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background dark:from-primary/20 dark:via-primary/10 dark:to-background">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">Current Balance</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">{formatCurrency(balance, currency)}</h2>
          </div>
          <div className="ml-4 p-3 rounded-full bg-primary/10 dark:bg-primary/20">
            <WalletIcon className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

