"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { BarChart3, TrendingUp, DollarSign } from "lucide-react";
import { useAdmin } from "@/contexts/admin-context";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  user_id: string;
}

interface Wager {
  id: string;
  fee_percentage: number;
  status: string;
  created_at: string;
}

interface WagerEntry {
  id: string;
  wager_id: string;
  amount: number;
  created_at: string;
}

interface DailyData {
  date: string;
  deposits: number;
  withdrawals: number;
  wagerEntries: number;
  wagerWins: number;
  commissions: number;
  transactions: number;
}

interface FinancialMetrics {
  totalRevenue: number;
  totalCommissions: number;
  totalPayouts: number;
  netProfit: number;
  averageCommissionRate: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AdminAnalyticsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  
  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [wagerEntries, setWagerEntries] = useState<WagerEntry[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics | null>(null);
  
  // Filters
  const [dateRange, setDateRange] = useState<"week" | "month" | "3months" | "all">("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [customDateRange, setCustomDateRange] = useState(false);


  const getDateFilter = useCallback(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (dateRange) {
      case "week":
        start = startOfDay(subDays(now, 7));
        break;
      case "month":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "3months":
        start = startOfDay(subMonths(now, 3));
        break;
      default:
        return null;
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }, [dateRange]);

  const fetchData = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const dateFilter = customDateRange && startDate && endDate
        ? {
            start: startOfDay(new Date(startDate)).toISOString(),
            end: endOfDay(new Date(endDate)).toISOString(),
          }
        : dateRange !== "all"
        ? getDateFilter()
        : null;

      // Fetch transactions
      const { apiGet } = await import('@/lib/api-client');
      const transactionsParams = new URLSearchParams();
      transactionsParams.set('limit', '10000');
      if (dateFilter) {
        transactionsParams.set('startDate', dateFilter.start);
        transactionsParams.set('endDate', dateFilter.end);
      }
      const transactionsResponse = await apiGet<{ transactions: Transaction[] }>(`/admin/transactions?${transactionsParams.toString()}`);
      const transactionsData = transactionsResponse.transactions || [];
      setTransactions(transactionsData);

      // Fetch wagers
      const wagersParams = new URLSearchParams();
      if (dateFilter) {
        wagersParams.set('startDate', dateFilter.start);
        wagersParams.set('endDate', dateFilter.end);
      }
      const wagersResponse = await apiGet<{ wagers: Wager[] }>(`/admin/wagers?${wagersParams.toString()}`);
      const wagersData = (wagersResponse.wagers || []).map(w => ({
        id: w.id,
        fee_percentage: w.fee_percentage || 0.05,
        status: w.status,
        created_at: w.created_at,
      }));
      setWagers(wagersData);

      // Fetch wager entries (we'll need to get these from wagers or create an endpoint)
      // For now, we'll calculate from transactions - ensure amounts are numbers
      const entriesData: WagerEntry[] = transactionsData
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

      // Calculate daily data
      const start = dateFilter ? parseISO(dateFilter.start) : parseISO((transactionsData || [])[0]?.created_at || new Date().toISOString());
      const end = dateFilter ? parseISO(dateFilter.end) : new Date();
      const days = eachDayOfInterval({ start, end });

      const daily = days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayStart = startOfDay(day).toISOString();
        const dayEnd = endOfDay(day).toISOString();

        const dayTransactions = (transactionsData || []).filter(t => 
          t.created_at >= dayStart && t.created_at <= dayEnd
        );
        const dayEntries = (entriesData || []).filter(e =>
          e.created_at >= dayStart && e.created_at <= dayEnd
        );

        // Calculate commissions for resolved wagers
        const resolvedWagers = (wagersData || []).filter(w => 
          (w.status === "RESOLVED" || w.status === "SETTLED") && 
          w.created_at >= dayStart && w.created_at <= dayEnd
        );
        
        let commissions = 0;
        resolvedWagers.forEach(wager => {
          const entries = (entriesData || []).filter(e => e.wager_id === wager.id);
          const totalPool = entries.reduce((sum, e) => {
            const amount = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount || '0');
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0);
          const feePercent = typeof wager.fee_percentage === 'number' ? wager.fee_percentage : parseFloat(wager.fee_percentage || '0.05');
          commissions += totalPool * (isNaN(feePercent) ? 0.05 : feePercent);
        });

        // Helper function to safely parse and sum amounts
        const safeSum = (transactions: Transaction[], type: string) => {
          return transactions
            .filter(t => t.type === type)
            .reduce((sum, t) => {
              const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
              return sum + (isNaN(amount) ? 0 : amount);
            }, 0);
        };

        return {
          date: format(day, "MMM d"),
          fullDate: dayStr,
          deposits: safeSum(dayTransactions, "deposit"),
          withdrawals: Math.abs(safeSum(dayTransactions, "withdrawal")),
          wagerEntries: Math.abs(safeSum(dayTransactions, "wager_entry")),
          wagerWins: safeSum(dayTransactions, "wager_win"),
          commissions,
          transactions: dayTransactions.length,
        };
      });

      setDailyData(daily);

      // Calculate financial metrics - ensure all amounts are numbers
      const totalWagerVolume = (entriesData || []).reduce((sum, e) => {
        const amount = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount || '0');
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      const resolvedWagers = (wagersData || []).filter(w => w.status === "RESOLVED" || w.status === "SETTLED");
      
      let totalCommissions = 0;
      resolvedWagers.forEach(wager => {
        const entries = (entriesData || []).filter(e => e.wager_id === wager.id);
        const totalPool = entries.reduce((sum, e) => {
          const amount = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount || '0');
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
        const feePercent = typeof wager.fee_percentage === 'number' ? wager.fee_percentage : parseFloat(wager.fee_percentage || '0.05');
        totalCommissions += totalPool * (isNaN(feePercent) ? 0.05 : feePercent);
      });

      // Helper function to safely parse and sum amounts
      const safeSum = (transactions: Transaction[], type: string) => {
        return transactions
          .filter(t => t.type === type)
          .reduce((sum, t) => {
            const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0);
      };

      const totalDeposits = safeSum(transactionsData, "deposit");
      const totalWithdrawals = Math.abs(safeSum(transactionsData, "withdrawal"));
      const totalWagerWins = safeSum(transactionsData, "wager_win");
      const totalWagerRefunds = safeSum(transactionsData, "wager_refund");

      // Ensure all values are numbers
      const commissions = Number(totalCommissions) || 0;
      const wins = Number(totalWagerWins) || 0;
      const refunds = Number(totalWagerRefunds) || 0;
      const withdrawals = Number(totalWithdrawals) || 0;
      
      const totalPayouts = wins + refunds + withdrawals;
      const netProfit = commissions - (wins + refunds);

      const metrics: FinancialMetrics = {
        totalRevenue: commissions,
        totalCommissions: commissions,
        totalPayouts: isNaN(totalPayouts) ? 0 : totalPayouts,
        netProfit: isNaN(netProfit) ? 0 : netProfit,
        averageCommissionRate: resolvedWagers.length > 0
          ? resolvedWagers.reduce((sum, w) => {
              const fee = typeof w.fee_percentage === 'number' ? w.fee_percentage : parseFloat(w.fee_percentage || '0.05');
              return sum + (isNaN(fee) ? 0.05 : fee);
            }, 0) / resolvedWagers.length
          : 0.05,
      };

      setFinancialMetrics(metrics);
    } catch (error) {
      logger.error("Error fetching analytics data", error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data.",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast, dateRange, startDate, endDate, customDateRange, getDateFilter]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, fetchData]);

  // Prepare chart data - ensure all amounts are numbers
  const safeSum = (transactions: Transaction[], type: string) => {
    return transactions
      .filter(t => t.type === type)
      .reduce((sum, t) => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
  };

  const transactionTypeData = [
    { name: "Deposits", value: financialMetrics ? safeSum(transactions, "deposit") : 0 },
    { name: "Withdrawals", value: financialMetrics ? Math.abs(safeSum(transactions, "withdrawal")) : 0 },
    { name: "Wager Entries", value: financialMetrics ? Math.abs(safeSum(transactions, "wager_entry")) : 0 },
    { name: "Wager Wins", value: financialMetrics ? safeSum(transactions, "wager_win") : 0 },
  ];

  const revenueData = dailyData.map(d => ({
    date: d.date,
    revenue: d.commissions,
    volume: d.wagerEntries,
  }));

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Analytics Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">Visual insights and trends</p>
        </div>

        {/* Filters - Compact */}
        <div className="bg-card border border-border/60 rounded-lg p-3 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            {/* Date Range Presets */}
            <div className="flex-shrink-0">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quick Range</label>
              <div className="flex gap-1.5">
                {(["week", "month", "3months", "all"] as const).map((range) => (
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
                    {range === "3months" ? "3M" : range.charAt(0).toUpperCase() + range.slice(1)}
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

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-2">
              {(dateRange !== "all" || customDateRange) && (
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-1 rounded-full font-medium">
                  Filters Active
                </span>
              )}
              <Button
                onClick={() => {
                  setDateRange("month");
                  setStartDate("");
                  setEndDate("");
                  setCustomDateRange(false);
                }}
                variant="ghost"
                size="sm"
                disabled={dateRange === "month" && !customDateRange}
                className="h-8 px-3 text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Financial Metrics - Compact */}
        {financialMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
            <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Revenue</h3>
                <div className="h-6 w-6 rounded-md bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <DollarSign className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="text-base font-bold text-green-600 dark:text-green-400">
                {formatCurrency(financialMetrics.totalRevenue, DEFAULT_CURRENCY as Currency)}
              </div>
            </div>
            <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Commissions</h3>
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <TrendingUp className="h-3 w-3 text-primary" />
                </div>
              </div>
              <div className="text-base font-bold text-primary">
                {formatCurrency(financialMetrics.totalCommissions, DEFAULT_CURRENCY as Currency)}
              </div>
            </div>
            <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Payouts</h3>
                <div className="h-6 w-6 rounded-md bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                  <DollarSign className="h-3 w-3 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="text-base font-bold text-red-600 dark:text-red-400">
                {formatCurrency(financialMetrics.totalPayouts, DEFAULT_CURRENCY as Currency)}
              </div>
            </div>
            <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Net Profit</h3>
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <BarChart3 className="h-3 w-3 text-primary" />
                </div>
              </div>
              <div className={`text-base font-bold ${
                financialMetrics.netProfit >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(financialMetrics.netProfit, DEFAULT_CURRENCY as Currency)}
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue Over Time */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue & Volume Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, DEFAULT_CURRENCY as Currency)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0088FE"
                  strokeWidth={2}
                  name="Commissions"
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#00C49F"
                  strokeWidth={2}
                  name="Wager Volume"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Transaction Types Distribution */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Transaction Types Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={transactionTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {transactionTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, DEFAULT_CURRENCY as Currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Transactions */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Transaction Volume</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="deposits" fill="#00C49F" name="Deposits" />
                <Bar dataKey="withdrawals" fill="#FF8042" name="Withdrawals" />
                <Bar dataKey="wagerEntries" fill="#0088FE" name="Wager Entries" />
                <Bar dataKey="wagerWins" fill="#FFBB28" name="Wager Wins" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Commissions */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Platform Commissions</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, DEFAULT_CURRENCY as Currency)}
                />
                <Legend />
                <Bar dataKey="commissions" fill="#8884d8" name="Commissions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </main>
  );
}

