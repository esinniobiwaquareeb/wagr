"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, DollarSign, Users, Calendar, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  user_id: string;
  description: string | null;
  reference: string | null;
}

interface Analytics {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalWagerEntries: number;
  totalWagerWins: number;
  totalWagerRefunds: number;
  netFlow: number;
  uniqueUsers: number;
}

export default function AdminReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  
  // Filters
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const [transactionType, setTransactionType] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [customDateRange, setCustomDateRange] = useState(false);

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

  const getDateFilter = () => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (dateRange) {
      case "today":
        start = startOfDay(now);
        break;
      case "week":
        start = startOfDay(subDays(now, 7));
        break;
      case "month":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      default:
        return null;
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchTransactions = useCallback(async (force = false) => {
    if (!isAdmin) return;

    try {
      let query = supabase
        .from("transactions")
        .select("*");

      // Apply date filter
      if (customDateRange && startDate && endDate) {
        query = query
          .gte("created_at", startOfDay(new Date(startDate)).toISOString())
          .lte("created_at", endOfDay(new Date(endDate)).toISOString());
      } else if (dateRange !== "all") {
        const dateFilter = getDateFilter();
        if (dateFilter) {
          query = query
            .gte("created_at", dateFilter.start)
            .lte("created_at", dateFilter.end);
        }
      }

      // Apply type filter
      if (transactionType !== "all") {
        query = query.eq("type", transactionType);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      setTransactions(data || []);

      // Calculate analytics
      const analyticsData: Analytics = {
        totalTransactions: data?.length || 0,
        totalDeposits: data?.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0) || 0,
        totalWithdrawals: data?.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0,
        totalWagerEntries: data?.filter(t => t.type === "wager_entry").reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0,
        totalWagerWins: data?.filter(t => t.type === "wager_win").reduce((sum, t) => sum + t.amount, 0) || 0,
        totalWagerRefunds: data?.filter(t => t.type === "wager_refund").reduce((sum, t) => sum + t.amount, 0) || 0,
        netFlow: (data?.filter(t => ["deposit", "wager_win", "wager_refund"].includes(t.type)).reduce((sum, t) => sum + t.amount, 0) || 0) -
                (data?.filter(t => ["withdrawal", "wager_entry"].includes(t.type)).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0),
        uniqueUsers: new Set(data?.map(t => t.user_id) || []).size,
      };

      setAnalytics(analyticsData);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transactions.",
        variant: "destructive",
      });
    }
  }, [supabase, isAdmin, toast, dateRange, transactionType, startDate, endDate, customDateRange]);

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
    return ["deposit", "wager_win", "wager_refund"].includes(type);
  };

  const transactionTypes = [
    { value: "all", label: "All Types" },
    { value: "deposit", label: "Deposits" },
    { value: "withdrawal", label: "Withdrawals" },
    { value: "wager_entry", label: "Wager Entries" },
    { value: "wager_win", label: "Wager Wins" },
    { value: "wager_refund", label: "Wager Refunds" },
  ];

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Reports & Analytics</h1>
          </div>
          <p className="text-sm text-muted-foreground">Comprehensive transaction analytics and reports</p>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold mt-1">{analytics.totalTransactions.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Flow</p>
                  <p className={`text-2xl font-bold mt-1 ${analytics.netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {analytics.netFlow >= 0 ? '+' : ''}{formatCurrency(analytics.netFlow, DEFAULT_CURRENCY as Currency)}
                  </p>
                </div>
                {analytics.netFlow >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400" />
                )}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Users</p>
                  <p className="text-2xl font-bold mt-1">{analytics.uniqueUsers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Deposits</p>
                  <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                    {formatCurrency(analytics.totalDeposits, DEFAULT_CURRENCY as Currency)}
                  </p>
                </div>
                <ArrowUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        )}

        {/* Detailed Stats */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Wager Entries</p>
              <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(analytics.totalWagerEntries, DEFAULT_CURRENCY as Currency)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Wager Wins</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(analytics.totalWagerWins, DEFAULT_CURRENCY as Currency)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Wager Refunds</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(analytics.totalWagerRefunds, DEFAULT_CURRENCY as Currency)}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <div className="flex gap-2 flex-wrap">
                {(["today", "week", "month", "all"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setDateRange(range);
                      setCustomDateRange(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
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
            <div>
              <label className="text-sm font-medium mb-2 block">Custom Range</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCustomDateRange(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCustomDateRange(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                />
              </div>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Transaction Type</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                {transactionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                setDateRange("all");
                setTransactionType("all");
                setStartDate("");
                setEndDate("");
                setCustomDateRange(false);
              }}
              variant="outline"
              size="sm"
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((trans) => (
                    <TableRow key={trans.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isPositive(trans.type) ? (
                            <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                          <span className="text-sm font-medium capitalize">
                            {getTransactionTypeLabel(trans.type)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${
                            isPositive(trans.type)
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isPositive(trans.type) ? "+" : "-"}
                          {formatCurrency(Math.abs(trans.amount), DEFAULT_CURRENCY as Currency)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="text-sm text-muted-foreground line-clamp-1">
                          {trans.description || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground">
                          {trans.user_id.substring(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(trans.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </main>
  );
}

