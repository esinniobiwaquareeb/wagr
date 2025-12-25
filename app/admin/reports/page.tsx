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
import { logger } from "@/lib/logger";

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

      // Calculate entries from transactions - ensure amounts are numbers
      const entriesData = data
        .filter(t => t.type === 'wager_join' || t.type === 'wager_entry')
        .map(t => {
          const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
          return {
            id: t.id,
            wager_id: (t as any).wager_id || '',
            amount: Math.abs(isNaN(amount) ? 0 : amount),
            created_at: t.created_at,
          };
        });
      setWagerEntries(entriesData);

      // Calculate platform commissions from resolved wagers
      const resolvedWagers = (wagersData || []).filter(w => w.status === "RESOLVED" || w.status === "SETTLED");
      let totalCommissions = 0;
      let totalWagerVolume = 0;

      resolvedWagers.forEach(wager => {
        const entries = (entriesData || []).filter(e => e.wager_id === wager.id);
        const totalPool = entries.reduce((sum, e) => {
          const amount = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount || '0');
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
        totalWagerVolume += totalPool;
        const feePercent = typeof wager.fee_percentage === 'number' ? wager.fee_percentage : parseFloat(wager.fee_percentage || '0.05');
        const commission = totalPool * (isNaN(feePercent) ? 0.05 : feePercent);
        totalCommissions += commission;
      });

      // Calculate analytics - ensure all amounts are numbers
      const totalDeposits = data?.filter(t => t.type === "deposit").reduce((sum, t) => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0) || 0;
      
      const totalWithdrawals = data?.filter(t => t.type === "withdrawal").reduce((sum, t) => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
        return sum + Math.abs(isNaN(amount) ? 0 : amount);
      }, 0) || 0;
      
      const totalWagerEntries = data?.filter(t => t.type === "wager_entry").reduce((sum, t) => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
        return sum + Math.abs(isNaN(amount) ? 0 : amount);
      }, 0) || 0;
      
      const totalWagerWins = data?.filter(t => t.type === "wager_win").reduce((sum, t) => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0) || 0;
      
      const totalWagerRefunds = data?.filter(t => t.type === "wager_refund").reduce((sum, t) => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0) || 0;

      // Ensure all values are numbers and calculate net flow safely
      const deposits = Number(totalDeposits) || 0;
      const withdrawals = Number(totalWithdrawals) || 0;
      const wins = Number(totalWagerWins) || 0;
      const refunds = Number(totalWagerRefunds) || 0;
      const entries = Number(totalWagerEntries) || 0;
      
      const netFlow = (deposits + wins + refunds) - (withdrawals + entries);
      
      const analyticsData: Analytics = {
        totalTransactions: data?.length || 0,
        totalDeposits: deposits,
        totalWithdrawals: withdrawals,
        totalWagerEntries: entries,
        totalWagerWins: wins,
        totalWagerRefunds: refunds,
        totalCommissions: Number(totalCommissions) || 0,
        netFlow: isNaN(netFlow) ? 0 : netFlow,
        uniqueUsers: new Set(data?.map(t => t.user_id) || []).size,
        platformRevenue: Number(totalCommissions) || 0,
        totalWagerVolume: Number(totalWagerVolume) || 0,
      };

      setAnalytics(analyticsData);
    } catch (error) {
      logger.error("Error fetching transactions", error);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border border-border/80">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-6 w-6 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent className="px-2 pb-1.5 pt-0">
                  <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Total Transactions</CardTitle>
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                  <DollarSign className="h-3 w-3 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className="text-lg font-bold leading-tight">{analytics.totalTransactions.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Net Flow</CardTitle>
                <div className={`h-6 w-6 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-colors flex-shrink-0 ${
                  analytics.netFlow >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  {analytics.netFlow >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className={`text-lg font-bold leading-tight ${analytics.netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {analytics.netFlow >= 0 ? '+' : ''}{formatCurrency(analytics.netFlow, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Unique Users</CardTitle>
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                  <Users className="h-3 w-3 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className="text-lg font-bold leading-tight">{analytics.uniqueUsers.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Total Deposits</CardTitle>
                <div className="h-6 w-6 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors flex-shrink-0">
                  <ArrowUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className="text-lg font-bold leading-tight text-green-600 dark:text-green-400">
                  {formatCurrency(analytics.totalDeposits, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Total Withdrawals</CardTitle>
                <div className="h-6 w-6 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors flex-shrink-0">
                  <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className="text-lg font-bold leading-tight text-red-600 dark:text-red-400">
                  {formatCurrency(analytics.totalWithdrawals, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Platform Revenue</CardTitle>
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                  <DollarSign className="h-3 w-3 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className="text-lg font-bold leading-tight text-primary">
                  {formatCurrency(analytics.platformRevenue, DEFAULT_CURRENCY as Currency)}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {analytics.totalWagerVolume > 0 
                    ? `${((analytics.totalCommissions / analytics.totalWagerVolume) * 100).toFixed(2)}% rate`
                    : '0% rate'}
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Wager Volume</CardTitle>
                <div className="h-6 w-6 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors flex-shrink-0">
                  <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className="text-lg font-bold leading-tight text-blue-600 dark:text-blue-400">
                  {formatCurrency(analytics.totalWagerVolume, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Wager Payouts</CardTitle>
                <div className="h-6 w-6 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors flex-shrink-0">
                  <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className="text-lg font-bold leading-tight text-green-600 dark:text-green-400">
                  {formatCurrency(analytics.totalWagerWins, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-2 pt-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">Wager Refunds</CardTitle>
                <div className="h-6 w-6 rounded-lg bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors flex-shrink-0">
                  <TrendingDown className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-1.5 pt-0">
                <div className="text-lg font-bold leading-tight text-yellow-600 dark:text-yellow-400">
                  {formatCurrency(analytics.totalWagerRefunds, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Commission Analysis */}
        {analytics && analytics.totalCommissions > 0 && (
          <Card className="border border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Platform Commission Analysis</CardTitle>
              <CardDescription className="text-xs">Detailed breakdown of platform revenue and commissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">Commission Rate</p>
                  <p className="text-xl font-bold text-primary">
                    {analytics.totalWagerVolume > 0 
                      ? `${((analytics.totalCommissions / analytics.totalWagerVolume) * 100).toFixed(2)}%`
                      : '5.00%'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Average fee percentage</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                  <p className="text-xs text-muted-foreground mb-1">Net Revenue</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(analytics.platformRevenue, DEFAULT_CURRENCY as Currency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total commissions earned</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">Profit Margin</p>
                  <p className="text-xl font-bold text-primary">
                    {analytics.totalWagerVolume > 0
                      ? `${((analytics.platformRevenue / analytics.totalWagerVolume) * 100).toFixed(2)}%`
                      : '0%'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Revenue as % of volume</p>
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
                      <span className="text-xs font-mono text-muted-foreground" title={row.user_id}>
                        {row.user_id.substring(0, 12)}...
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

