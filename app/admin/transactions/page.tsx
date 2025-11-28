"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { ArrowUp, ArrowDown, ExternalLink, Link as LinkIcon, Copy, Check } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { getCurrentUser } from "@/lib/auth/client";
import Link from "next/link";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  user_id: string;
  description: string | null;
  reference: string | null;
  wager_id: string | null;
  profiles?: {
    id: string;
    username: string | null;
    email: string | null;
  } | null;
  _searchUsername?: string;
  _searchEmail?: string;
}

export default function AdminTransactionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const checkAdmin = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser(true); // Force refresh
      if (!currentUser || !currentUser.is_admin) {
        router.replace("/admin/login");
        return;
      }

      setUser(currentUser);
      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin status:", error);
      router.replace("/admin/login");
    }
  }, [router]);

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
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            email
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      
      // Transform the data - Supabase returns profiles as an array, extract first element
      const transformedData = (data || []).map((transaction: any) => ({
        ...transaction,
        profiles: Array.isArray(transaction.profiles) 
          ? transaction.profiles[0] 
          : transaction.profiles || null,
      }));
      
      setTransactions(transformedData);
      
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
    let mounted = true;
    
    checkAdmin().then(() => {
      if (mounted) {
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchTransactions();
    }
  }, [isAdmin, fetchTransactions]);

  // Helper functions - must be defined before conditional returns
  const getTransactionTypeLabel = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const isPositive = (type: string) => {
    return ["deposit", "wager_win", "wager_refund", "quiz_refund", "transfer_in"].includes(type);
  };

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopiedRef(reference);
      setTimeout(() => setCopiedRef(null), 2000);
      toast({
        title: "Copied",
        description: "Reference copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const parseReference = (reference: string | null, type: string) => {
    if (!reference) {
      return { display: "N/A", link: null, linkText: null, fullReference: null };
    }

    // Transfer references: transfer_senderId_recipientId_timestamp_random
    if (reference.startsWith("transfer_")) {
      const parts = reference.split("_");
      if (parts.length >= 4) {
        return {
          display: "Transfer",
          link: null,
          linkText: null,
          fullReference: reference,
        };
      }
      return { display: reference, link: null, linkText: null, fullReference: reference };
    }

    // Bill payment references: bill_airtime_... or bill_data_...
    if (reference.startsWith("bill_")) {
      const billType = reference.includes("_airtime_") ? "Airtime" : "Data";
      return {
        display: `${billType} Purchase`,
        link: null,
        linkText: null,
        fullReference: reference,
      };
    }

    // Deposit references: wagr_userId_timestamp_random
    if (reference.startsWith("wagr_")) {
      return {
        display: "Deposit",
        link: null,
        linkText: null,
        fullReference: reference,
      };
    }

    // Check if it's a UUID (wager or quiz reference)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(reference)) {
      // Determine if it's a wager or quiz based on transaction type
      if (type.includes("wager") || type === "wager_create" || type === "wager_join" || type === "wager_win" || type === "wager_refund") {
        return {
          display: reference.substring(0, 8) + "...",
          link: `/admin/wagers/${reference}`,
          linkText: "View Wager",
          fullReference: reference,
        };
      } else if (type.includes("quiz") || type === "quiz_creation" || type === "quiz_refund") {
        return {
          display: reference.substring(0, 8) + "...",
          link: `/admin/quizzes/${reference}`,
          linkText: "View Quiz",
          fullReference: reference,
        };
      }
      // Generic UUID - could be wager or quiz, default to wager
      return {
        display: reference.substring(0, 8) + "...",
        link: `/admin/wagers/${reference}`,
        linkText: "View",
        fullReference: reference,
      };
    }

    // Default: show truncated reference
    return {
      display: reference.length > 30 ? reference.substring(0, 30) + "..." : reference,
      link: null,
      linkText: null,
      fullReference: reference,
    };
  };

  // Custom filtered transactions for search that includes profile data
  // Must be called before conditional returns to follow Rules of Hooks
  const filteredTransactions = useMemo(() => {
    if (!transactions.length) return transactions;
    
    // This will be handled by DataTable's built-in search, but we need to ensure
    // the data structure is searchable. The search will work on type, description, and user_id
    // For profile search, we'll add a computed field
    return transactions.map(t => ({
      ...t,
      // Add searchable fields for profile data
      _searchUsername: t.profiles?.username || '',
      _searchEmail: t.profiles?.email || '',
    }));
  }, [transactions]);

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

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Transactions</h1>
          <p className="text-sm text-muted-foreground">View all transactions in the system</p>
        </div>

        <DataTable
          data={filteredTransactions}
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
                <div className="max-w-xs">
                  <span className="text-sm text-muted-foreground break-words whitespace-normal">
                    {row.description || "N/A"}
                  </span>
                </div>
              ),
            },
            {
              id: "reference",
              header: "Reference",
              accessorKey: "reference",
              cell: (row) => {
                const refInfo = parseReference(row.reference, row.type);
                const fullRef = refInfo.fullReference || row.reference || null;
                const isCopied = fullRef ? copiedRef === fullRef : false;
                
                return (
                  <div className="flex items-center gap-2 min-w-[160px]">
                    {refInfo.link ? (
                      <div className="flex items-center gap-2">
                        <Link
                          href={refInfo.link}
                          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                          title={fullRef || undefined}
                        >
                          <span className="font-mono text-xs">{refInfo.display}</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        {fullRef && (
                          <button
                            onClick={() => fullRef && copyReference(fullRef)}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="Copy reference"
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-mono text-muted-foreground truncate" title={fullRef || refInfo.display || undefined}>
                            {refInfo.display}
                          </span>
                          {refInfo.linkText && (
                            <span className="text-xs text-muted-foreground">{refInfo.linkText}</span>
                          )}
                        </div>
                        {fullRef && (
                          <button
                            onClick={() => fullRef && copyReference(fullRef)}
                            className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                            title="Copy reference"
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            },
            {
              id: "user",
              header: "User",
              cell: (row) => {
                const profile = row.profiles;
                const displayName = profile?.username || profile?.email || `User ${row.user_id.substring(0, 8)}`;
                return (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {displayName}
                    </span>
                    {profile?.username && profile?.email && (
                      <span className="text-xs text-muted-foreground truncate">
                        {profile.email}
                      </span>
                    )}
                  </div>
                );
              },
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
          searchPlaceholder="Search by type, description, reference, username, or email..."
          searchKeys={["type", "description", "reference", "user_id", "_searchUsername", "_searchEmail"]}
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

