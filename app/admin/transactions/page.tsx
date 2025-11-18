"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { ArrowUp, ArrowDown } from "lucide-react";
import { DataTable } from "@/components/data-table";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  user_id: string;
  description: string | null;
  wager_id: string | null;
}

export default function AdminTransactionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const checkAdmin = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      router.push("/admin/login");
      return;
    }

    setUser(currentUser);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUser.id)
      .single();

    if (error || !profile?.is_admin) {
      router.push("/admin/login");
      return;
    }

    setIsAdmin(true);
  }, [supabase, router]);

  const fetchTransactions = useCallback(async (force = false) => {
    if (!isAdmin) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cached = cache.get<Transaction[]>(CACHE_KEYS.ADMIN_TRANSACTIONS);
      
      if (cached) {
        setTransactions(cached);
        
        // Check if cache is stale - refresh in background if needed
        const cacheEntry = cache.memoryCache.get(CACHE_KEYS.ADMIN_TRANSACTIONS);
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.ADMIN_DATA / 2;
          
          if (age > staleThreshold) {
            fetchTransactions(true).catch(() => {});
          }
        }
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setTransactions(data || []);
      
      // Cache the results
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      cache.set(CACHE_KEYS.ADMIN_TRANSACTIONS, data || [], CACHE_TTL.ADMIN_DATA);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transactions.",
        variant: "destructive",
      });
    }
  }, [supabase, isAdmin, toast]);

  useEffect(() => {
    checkAdmin().then(() => {
      setLoading(false);
    });
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchTransactions();
    }
  }, [isAdmin, fetchTransactions]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const getTransactionTypeLabel = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const isPositive = (type: string) => {
    return ["deposit", "wager_win", "refund"].includes(type);
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Transactions</h1>
          </div>
          <p className="text-sm text-muted-foreground">View all transactions in the system</p>
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
                  <span className="text-sm font-medium capitalize">
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
                  className={`font-semibold ${
                    isPositive(row.type)
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {isPositive(row.type) ? "+" : "-"}
                  {formatCurrency(Math.abs(row.amount), DEFAULT_CURRENCY as Currency)}
                </span>
              ),
            },
            {
              id: "description",
              header: "Description",
              accessorKey: "description",
              cell: (row) => (
                <span className="text-sm text-muted-foreground line-clamp-1">
                  {row.description || "N/A"}
                </span>
              ),
            },
            {
              id: "user_id",
              header: "User ID",
              accessorKey: "user_id",
              cell: (row) => (
                <span className="text-xs font-mono text-muted-foreground">
                  {row.user_id.substring(0, 8)}...
                </span>
              ),
            },
            {
              id: "created_at",
              header: "Date",
              accessorKey: "created_at",
              cell: (row) => (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
                </span>
              ),
            },
          ]}
          searchable
          searchPlaceholder="Search by type, description, or user ID..."
          searchKeys={["type", "description", "user_id"]}
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

