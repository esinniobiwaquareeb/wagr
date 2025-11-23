"use client";

import { Users, Crown, Trophy } from "lucide-react";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";

interface Entry {
  id: string;
  side: string;
  amount: number;
  user_id: string;
  created_at: string;
}

interface WagerParticipantsProps {
  entries: Entry[];
  userNames: Record<string, string>;
  wager: {
    creator_id?: string;
    status: string;
    winning_side: string | null;
    side_a: string;
    side_b: string;
    currency?: string;
  };
}

export function WagerParticipants({ entries, userNames, wager }: WagerParticipantsProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No participants yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto">
      {entries.map((entry) => {
        const isCreator = wager.creator_id === entry.user_id;
        const isWinner =
          (wager.status === "RESOLVED" || wager.status === "SETTLED") &&
          wager.winning_side &&
          entry.side === wager.winning_side.toLowerCase();

        return (
          <div
            key={entry.id}
            className={`flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-muted/30 transition ${
              isWinner
                ? "bg-green-500/10 border-green-500/30"
                : isCreator
                ? "bg-blue-500/10 border-blue-500/30"
                : ""
            }`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  entry.side === "a" ? "bg-primary" : "bg-primary/60"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">
                    {userNames[entry.user_id] || `User ${entry.user_id.slice(0, 8)}`}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isCreator && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                        <Crown className="h-3 w-3" />
                        Creator
                      </span>
                    )}
                    {isWinner && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-semibold">
                        <Trophy className="h-3 w-3" />
                        Winner
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.side === "a" ? wager.side_a : wager.side_b}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-foreground whitespace-nowrap ml-2">
              {formatCurrency(entry.amount, (wager.currency || DEFAULT_CURRENCY) as Currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

