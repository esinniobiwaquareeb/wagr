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
          <div>
            <CardTitle className="text-lg sm:text-xl">Recent Transactions</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Your latest wallet activity
            </CardDescription>
          </div>
          {transactions.length > 0 && (
            <Link
              href="/wallet/transactions"
              className="flex items-center gap-1.5 text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors font-medium px-2 py-1.5 rounded-md hover:bg-primary/10 touch-manipulation"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {transactions.length === 0 ? (
          <div className="py-8 sm:py-12 text-center">
            <div className="max-w-xs mx-auto">
              <p className="text-sm sm:text-base text-muted-foreground mb-2">No transactions yet</p>
              <p className="text-xs text-muted-foreground/70">
                Your transaction history will appear here once you start using your wallet
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1 sm:space-y-2">
            {transactions.map((trans) => (
              <Link
                key={trans.id}
                href="/wallet/transactions"
                className="flex justify-between items-start pb-3 sm:pb-3.5 border-b border-border/50 last:border-b-0 gap-3 sm:gap-4 hover:bg-muted/30 -mx-2 sm:-mx-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-colors touch-manipulation active:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold capitalize text-foreground text-sm sm:text-base mb-1">
                    {trans.type === 'transfer_out' ? 'Transfer Sent' : 
                     trans.type === 'transfer_in' ? 'Transfer Received' :
                     trans.type === 'challenge_reward' ? 'Challenge Reward' :
                     trans.type === 'streak_reward' ? 'Streak Reward' :
                     trans.type === 'quiz_refund' ? 'Quiz Refund' :
                     trans.type === 'quiz_win' ? 'Quiz Win' :
                     trans.type === 'quiz_join' ? 'Quiz Joined' :
                     trans.type.replace(/_/g, " ")}
                  </p>
                  {trans.description ? (
                    <>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-1">
                        {trans.description}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {format(new Date(trans.created_at), "MMM d, h:mm a")}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs sm:text-sm text-muted-foreground/70">
                      {format(new Date(trans.created_at), "MMM d, h:mm a")}
                    </p>
                  )}
                </div>
                <p
                  className={`font-bold text-sm sm:text-base whitespace-nowrap flex-shrink-0 ${
                    (() => {
                      const positiveTypes = ["deposit", "wager_win", "wager_refund", "quiz_win", "quiz_refund", "transfer_in", "challenge_reward", "streak_reward"];
                      return positiveTypes.includes(trans.type) || trans.amount > 0;
                    })()
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {(() => {
                    const positiveTypes = ["deposit", "wager_win", "wager_refund", "quiz_win", "quiz_refund", "transfer_in", "challenge_reward", "streak_reward"];
                    return positiveTypes.includes(trans.type) || trans.amount > 0;
                  })() ? "+" : ""}
                  {formatCurrency(Math.abs(trans.amount), currency)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

