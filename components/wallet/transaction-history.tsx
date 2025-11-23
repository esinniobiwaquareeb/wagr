"use client";

import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, type Currency } from "@/lib/currency";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  reference: string | null;
  description?: string | null;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  currency: Currency;
}

export function TransactionHistory({ transactions, currency }: TransactionHistoryProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Transaction History</CardTitle>
          {transactions.length > 0 && (
            <Link
              href="/wallet/transactions"
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <CardDescription className="text-sm">Recent wallet transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((trans) => (
              <div
                key={trans.id}
                className="flex justify-between items-start pb-3 border-b border-border/50 last:border-b-0 gap-3 hover:bg-muted/30 -mx-2 px-2 py-1.5 rounded-md transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium capitalize text-foreground text-sm">
                    {trans.type === 'transfer_out' ? 'Transfer Sent' : 
                     trans.type === 'transfer_in' ? 'Transfer Received' :
                     trans.type.replace(/_/g, " ")}
                  </p>
                  {trans.description ? (
                    <>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {trans.description}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {format(new Date(trans.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {format(new Date(trans.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  )}
                </div>
                <p
                  className={`font-semibold text-sm whitespace-nowrap flex-shrink-0 ${
                    trans.amount > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {trans.amount > 0 ? "+" : ""}
                  {formatCurrency(Math.abs(trans.amount), currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

