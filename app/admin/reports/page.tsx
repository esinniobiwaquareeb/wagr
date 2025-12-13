"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, DollarSign, Users, Calendar, Filter, Loader2 } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAdmin } from "@/contexts/admin-context";

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
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const [fetching, setFetching] = useState(false);
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

  const fetchTransactions = useCallback(async () => {
    if (!isAdmin) return;

    setFetching(true);
    try {
      const { apiGet } = await import('@/lib/api-client');
      
      // Build query params
      const params = new URLSearchParams();
      params.set('limit', '1000');
      
      // Apply date filter
      if (customDateRange && startDate && endDate) {
        params.set('startDate', startOfDay(new Date(startDate)).toISOString());
        params.set('endDate', endOfDay(new Date(endDate)).toISOString());
      } else if (dateRange !== "all") {
        const dateFilter = getDateFilter();
        if (dateFilter) {
          params.set('startDate', dateFilter.start);
          params.set('endDate', dateFilter.end);
        }
      }

      // Apply type filter
      if (transactionType !== "all") {
        params.set('type', transactionType);
      }

      const response = await apiGet<{ transactions: Transaction[] }>(`/admin/transactions?${params.toString()}`);
      const data = response.transactions || [];
      setTransactions(data);

      // Fetch wagers for commission calculation
      const wagersParams = new URLSearchParams();
      if (customDateRange && startDate && endDate) {
        wagersParams.set('startDate', startOfDay(new Date(startDate)).toISOString());
        wagersParams.set('endDate', endOfDay(new Date(endDate)).toISOString());
      } else if (dateRange !== "all") {
        const dateFilter = getDateFilter();
        if (dateFilter) {
          wagersParams.set('startDate', dateFilter.start);
          wagersParams.set('endDate', dateFilter.end);
        }
      }

      const wagersResponse = await apiGet<{ wagers: any[] }>(`/admin/wagers?${wagersParams.toString()}`);
      const wagersData = (wagersResponse.wagers || []).map(w => ({
        id: w.id,
        fee_percentage: w.fee_percentage || 0.05,
        status: w.status,
        created_at: w.created_at,
      }));
      setWagers(wagersData);

      // Calculate entries from transactions
      const entriesData = data
        .filter(t => t.type === 'wager_join' || t.type === 'wager_entry')
        .map(t => ({
          id: t.id,
          wager_id: (t as any).wager_id || '',
          amount: Math.abs(t.amount),
          created_at: t.created_at,
        }));
      setWagerEntries(entriesData);

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
    } finally {
      setFetching(false);
    }
  }, [isAdmin, toast, dateRange, transactionType, startDate, endDate, customDateRange]);

  useEffect(() => {
    if (isAdmin) {
      fetchTransactions();
    }
  }, [isAdmin, fetchTransactions]);

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
    <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Comprehensive transaction analytics and financial reports
          </p>
        </div>

        {/* Analytics Cards */}
        {fetching && !analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border border-border/80">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-9 w-9 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalTransactions.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Flow</CardTitle>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-colors ${
                  analytics.netFlow >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  {analytics.netFlow >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${analytics.netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {analytics.netFlow >= 0 ? '+' : ''}{formatCurrency(analytics.netFlow, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.uniqueUsers.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Deposits</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(analytics.totalDeposits, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Withdrawals</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                  <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(analytics.totalWithdrawals, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Platform Revenue</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(analytics.platformRevenue, DEFAULT_CURRENCY as Currency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.totalWagerVolume > 0 
                    ? `${((analytics.totalCommissions / analytics.totalWagerVolume) * 100).toFixed(2)}% commission rate`
                    : '0% commission rate'}
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Wager Volume</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(analytics.totalWagerVolume, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Wager Payouts</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(analytics.totalWagerWins, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Wager Refunds</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                  <TrendingDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {formatCurrency(analytics.totalWagerRefunds, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Commission Analysis */}
        {analytics && analytics.totalCommissions > 0 && (
          <Card className="border border-border/80">
            <CardHeader>
              <CardTitle>Platform Commission Analysis</CardTitle>
              <CardDescription>Detailed breakdown of platform revenue and commissions</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="border border-border/80">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Filters</CardTitle>
            </div>
            <CardDescription>Filter transactions by date range and type</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="border border-border/80">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              {fetching ? "Loading transactions..." : "Filtered transaction records based on selected criteria"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fetching && transactions.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

