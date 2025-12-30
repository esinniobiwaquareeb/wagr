"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format, startOfDay, endOfDay, subDays, subMonths } from "date-fns";
import { ArrowUp, ArrowDown, ExternalLink, Link as LinkIcon, Copy, Check, Eye, DollarSign, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { useAdmin } from "@/contexts/admin-context";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

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
  const { toast } = useToast();
  const { admin, isAdmin } = useAdmin();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const [transactionType, setTransactionType] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customDateRange, setCustomDateRange] = useState(false);

  const transactionTypes = [
    { value: "all", label: "All Types" },
    { value: "deposit", label: "Deposits" },
    { value: "withdrawal", label: "Withdrawals" },
    { value: "wager_join", label: "Wager Join" },
    { value: "wager_win", label: "Wager Win" },
    { value: "wager_refund", label: "Wager Refund" },
    { value: "transfer_in", label: "Transfer In" },
    { value: "transfer_out", label: "Transfer Out" },
    { value: "quiz_creation", label: "Quiz Creation" },
    { value: "quiz_refund", label: "Quiz Refund" },
  ];

  const getDateFilter = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() };
      case "week":
        return { start: startOfDay(subDays(now, 7)).toISOString(), end: endOfDay(now).toISOString() };
      case "month":
        return { start: startOfDay(subMonths(now, 1)).toISOString(), end: endOfDay(now).toISOString() };
      default:
        return null;
    }
  }, [dateRange]);

  const fetchTransactions = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      const { apiGet } = await import('@/lib/api-client');
      
      const params = new URLSearchParams();
      params.set('limit', '500');
      
      // Apply date filter
      const dateFilter = customDateRange && startDate && endDate
        ? { start: startOfDay(new Date(startDate)).toISOString(), end: endOfDay(new Date(endDate)).toISOString() }
        : getDateFilter();
      
      if (dateFilter) {
        params.set('startDate', dateFilter.start);
        params.set('endDate', dateFilter.end);
      }
      
      if (transactionType !== 'all') {
        params.set('type', transactionType);
      }
      
      const response = await apiGet<{ transactions: Transaction[] }>(`/admin/transactions?${params.toString()}`);
      
      // Transform the data to match expected format
      const transformedData = (response.transactions || []).map((transaction: any) => ({
        ...transaction,
        profiles: transaction.user
          ? {
              id: transaction.user.id,
              username: transaction.user.username,
              email: transaction.user.email,
            }
          : null,
      }));
      
      setTransactions(transformedData);
    } catch (error) {
      logger.error("Error fetching transactions", error);
      toast({
        title: "Error",
        description: "Failed to fetch transactions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast, dateRange, transactionType, startDate, endDate, customDateRange, getDateFilter]);

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
      logger.error("Failed to copy", error);
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

  // Calculate stats
  const stats = useMemo(() => {
    const totalDeposits = transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const totalWithdrawals = transactions
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const totalWagerVolume = transactions
      .filter(t => t.type === 'wager_join' || t.type === 'wager_entry')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const totalWagerWins = transactions
      .filter(t => t.type === 'wager_win')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    
    return { totalDeposits, totalWithdrawals, totalWagerVolume, totalWagerWins, count: transactions.length };
  }, [transactions]);

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


  return (
    <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Monitor all financial transactions across the platform
          </p>
        </div>

        {/* Stats - Compact */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Total</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <DollarSign className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold">{stats.count.toLocaleString()}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Deposits</h3>
              <div className="h-6 w-6 rounded-md bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-base font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.totalDeposits, DEFAULT_CURRENCY as Currency)}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Withdrawals</h3>
              <div className="h-6 w-6 rounded-md bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="text-base font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.totalWithdrawals, DEFAULT_CURRENCY as Currency)}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Wager Vol</h3>
              <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <DollarSign className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-base font-bold">{formatCurrency(stats.totalWagerVolume, DEFAULT_CURRENCY as Currency)}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Wager Wins</h3>
              <div className="h-6 w-6 rounded-md bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <TrendingUp className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-base font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stats.totalWagerWins, DEFAULT_CURRENCY as Currency)}</div>
          </div>
        </div>

        {/* Filters - Compact */}
        <div className="bg-card border border-border/60 rounded-lg p-3">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            {/* Date Range Presets */}
            <div className="flex-shrink-0">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quick Range</label>
              <div className="flex gap-1.5">
                {(["today", "week", "month", "all"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setDateRange(range);
                      setCustomDateRange(false);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      dateRange === range && !customDateRange
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div className="flex-shrink-0">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Custom Range</label>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCustomDateRange(true);
                    setDateRange("all");
                  }}
                  className={`px-2.5 py-1 rounded-md border text-xs bg-background transition-colors ${
                    customDateRange && startDate ? "border-primary bg-primary/5" : "border-border"
                  }`}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCustomDateRange(true);
                    setDateRange("all");
                  }}
                  className={`px-2.5 py-1 rounded-md border text-xs bg-background transition-colors ${
                    customDateRange && endDate ? "border-primary bg-primary/5" : "border-border"
                  }`}
                />
              </div>
            </div>

            {/* Transaction Type */}
            <div className="flex-shrink-0">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className={`px-2 py-1.5 rounded-md border text-xs min-w-[140px] transition-colors ${
                  transactionType !== "all" 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-background"
                } disabled:opacity-50`}
              >
                {transactionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-2">
              {(dateRange !== "all" || transactionType !== "all" || customDateRange) && (
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-1 rounded-full font-medium">
                  Filters Active
                </span>
              )}
              <Button
                onClick={() => {
                  setDateRange("all");
                  setTransactionType("all");
                  setStartDate("");
                  setEndDate("");
                  setCustomDateRange(false);
                }}
                variant="ghost"
                size="sm"
                disabled={loading || (dateRange === "all" && transactionType === "all" && !customDateRange)}
                className="h-8 px-3 text-xs"
              >
                Clear
              </Button>
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <Card className="border border-border/80">
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>View and search through all transaction records</CardDescription>
          </CardHeader>
          <CardContent>
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
            {
              id: "actions",
              header: "Actions",
              cell: (row) => (
                <Link
                  href={`/admin/transactions/${row.id}`}
                  className="inline-flex items-center justify-center p-2 hover:bg-muted rounded transition-colors"
                  title="View transaction details"
                >
                  <Eye className="h-4 w-4 text-muted-foreground hover:text-primary transition" />
                </Link>
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

