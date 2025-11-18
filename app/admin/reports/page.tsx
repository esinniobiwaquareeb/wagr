"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, DollarSign, Users, Calendar, Filter } from "lucide-react";
import { DataTable } from "@/components/data-table";
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
  totalCommissions: number;
  netFlow: number;
  uniqueUsers: number;
  platformRevenue: number;
  totalWagerVolume: number;
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
  const [wagers, setWagers] = useState<any[]>([]);
  const [wagerEntries, setWagerEntries] = useState<any[]>([]);
  
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

      // Fetch wagers and entries for commission calculation
      let wagersQuery = supabase.from("wagers").select("id, fee_percentage, status, created_at");
      let entriesQuery = supabase.from("wager_entries").select("id, wager_id, amount, created_at");

      if (customDateRange && startDate && endDate) {
        const start = startOfDay(new Date(startDate)).toISOString();
        const end = endOfDay(new Date(endDate)).toISOString();
        wagersQuery = wagersQuery.gte("created_at", start).lte("created_at", end);
        entriesQuery = entriesQuery.gte("created_at", start).lte("created_at", end);
      } else if (dateRange !== "all") {
        const dateFilter = getDateFilter();
        if (dateFilter) {
          wagersQuery = wagersQuery.gte("created_at", dateFilter.start).lte("created_at", dateFilter.end);
          entriesQuery = entriesQuery.gte("created_at", dateFilter.start).lte("created_at", dateFilter.end);
        }
      }

      const { data: wagersData } = await wagersQuery;
      const { data: entriesData } = await entriesQuery;

      setWagers(wagersData || []);
      setWagerEntries(entriesData || []);

      // Calculate platform commissions from resolved wagers
      const resolvedWagers = (wagersData || []).filter(w => w.status === "RESOLVED" || w.status === "SETTLED");
      let totalCommissions = 0;
      let totalWagerVolume = 0;

      resolvedWagers.forEach(wager => {
        const entries = (entriesData || []).filter(e => e.wager_id === wager.id);
        const totalPool = entries.reduce((sum, e) => sum + e.amount, 0);
        totalWagerVolume += totalPool;
        const commission = totalPool * (wager.fee_percentage || 0.05);
        totalCommissions += commission;
      });

      // Calculate analytics
      const totalDeposits = data?.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalWithdrawals = data?.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      const totalWagerEntries = data?.filter(t => t.type === "wager_entry").reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      const totalWagerWins = data?.filter(t => t.type === "wager_win").reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalWagerRefunds = data?.filter(t => t.type === "wager_refund").reduce((sum, t) => sum + t.amount, 0) || 0;

      const analyticsData: Analytics = {
        totalTransactions: data?.length || 0,
        totalDeposits,
        totalWithdrawals,
        totalWagerEntries,
        totalWagerWins,
        totalWagerRefunds,
        totalCommissions,
        netFlow: (totalDeposits + totalWagerWins + totalWagerRefunds) - (totalWithdrawals + totalWagerEntries),
        uniqueUsers: new Set(data?.map(t => t.user_id) || []).size,
        platformRevenue: totalCommissions,
        totalWagerVolume,
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

        {/* Financial Breakdown */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Platform Commissions</p>
              <p className="text-xl font-semibold text-primary">
                {formatCurrency(analytics.totalCommissions, DEFAULT_CURRENCY as Currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.totalWagerVolume > 0 
                  ? `${((analytics.totalCommissions / analytics.totalWagerVolume) * 100).toFixed(2)}% of volume`
                  : '0% of volume'}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Total Wager Volume</p>
              <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                {formatCurrency(analytics.totalWagerVolume, DEFAULT_CURRENCY as Currency)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Wager Wins (Payouts)</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(analytics.totalWagerWins, DEFAULT_CURRENCY as Currency)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Wager Refunds</p>
              <p className="text-xl font-semibold text-yellow-600 dark:text-yellow-400">
                {formatCurrency(analytics.totalWagerRefunds, DEFAULT_CURRENCY as Currency)}
              </p>
            </div>
          </div>
        )}

        {/* Commission Analysis */}
        {analytics && analytics.totalCommissions > 0 && (
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Platform Commission Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Commission Rate</p>
                <p className="text-2xl font-bold text-primary">
                  {analytics.totalWagerVolume > 0 
                    ? `${((analytics.totalCommissions / analytics.totalWagerVolume) * 100).toFixed(2)}%`
                    : '5.00%'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Average fee percentage</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Net Revenue</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(analytics.platformRevenue, DEFAULT_CURRENCY as Currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total commissions earned</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Profit Margin</p>
                <p className="text-2xl font-bold text-primary">
                  {analytics.totalWagerVolume > 0
                    ? `${((analytics.platformRevenue / analytics.totalWagerVolume) * 100).toFixed(2)}%`
                    : '0%'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Revenue as % of volume</p>
              </div>
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

