"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { ArrowUp, ArrowDown, ArrowLeft } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { BackButton } from "@/components/back-button";
import { Skeleton } from "@/components/ui/skeleton";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  reference: string | null;
  description?: string | null;
}

export default function TransactionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth({
    requireAuth: true,
    redirectTo: "/wagers?login=true"
  });
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = DEFAULT_CURRENCY as Currency;

  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      setLoading(true);
      const { walletApi } = await import('@/lib/api-client');
      const response = await walletApi.getTransactions({ limit: 1000 });
      
      const transData = response?.transactions || [];
      setTransactions(transData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, toast]);

  // Debounced refetch function for subscriptions
  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchTransactions();
    }, 1000); // Debounce by 1 second
  }, [fetchTransactions]);

  useEffect(() => {
    if (user) {
      fetchTransactions();

      // Subscribe to real-time updates
      const channel = supabase
        .channel(`transactions:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            debouncedRefetch();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
      };
    }
  }, [user, supabase]); // Removed fetchTransactions and debouncedRefetch from dependencies

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'transfer_out': 'Transfer Sent',
      'transfer_in': 'Transfer Received',
      'deposit': 'Deposit',
      'withdrawal': 'Withdrawal',
      'wager_create': 'Wager Created',
      'wager_join': 'Wager Joined',
      'wager_win': 'Wager Win',
      'wager_refund': 'Wager Refund',
      'wager_edit': 'Wager Edited',
    };
    return labels[type] || type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const isPositive = (type: string) => {
    return ["deposit", "wager_win", "wager_refund", "transfer_in"].includes(type);
  };

  if (authLoading || loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto p-3 md:p-6 text-center py-12">
          <p className="text-muted-foreground">Please log in to view transactions</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto p-3 md:p-6">
        <div className="mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2 md:hidden">
            <BackButton fallbackHref="/wallet" />
            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold">Transaction History</h1>
          </div>
          <h1 className="hidden md:block text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">Transaction History</h1>
          <p className="text-xs md:text-base text-muted-foreground">View all your wallet transactions</p>
        </div>

        <DataTable
          data={transactions}
          columns={[
            {
              id: "type",
              header: "Type",
              accessorKey: "type",
              cell: (row) => (
                <div className="flex items-center gap-2">
                  {isPositive(row.type) ? (
                    <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-sm font-medium">
                    {getTransactionTypeLabel(row.type)}
                  </span>
                </div>
              ),
            },
            {
              id: "amount",
              header: "Amount",
              accessorKey: "amount",
              cell: (row) => (
                <span
                  className={`font-semibold text-sm md:text-base ${
                    isPositive(row.type)
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {isPositive(row.type) ? "+" : ""}
                  {formatCurrency(Math.abs(row.amount), currency)}
                </span>
              ),
            },
            {
              id: "description",
              header: "Description",
              accessorKey: "description",
              cell: (row) => (
                <span className="text-xs md:text-sm text-muted-foreground line-clamp-2 max-w-md">
                  {row.description || "N/A"}
                </span>
              ),
            },
            {
              id: "created_at",
              header: "Date",
              accessorKey: "created_at",
              cell: (row) => (
                <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
                </span>
              ),
            },
          ]}
          searchable
          searchPlaceholder="Search by type or description..."
          searchKeys={["type", "description"]}
          pagination
          pageSize={25}
          sortable
          defaultSort={{ key: "created_at", direction: "desc" }}
          emptyMessage="No transactions found"
        />
      </div>
    </main>
  );
}

