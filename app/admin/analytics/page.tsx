"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { BarChart3, TrendingUp, DollarSign, Users, Calendar, Filter } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/client";
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
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
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

  const checkAdmin = useCallback(async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.is_admin) {
      router.push("/admin/login");
      return;
    }

    setUser(currentUser);
    setIsAdmin(true);
  }, [router]);

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
      // For now, we'll calculate from transactions
      const entriesData: WagerEntry[] = transactionsData
        .filter(t => t.type === 'wager_join' || t.type === 'wager_entry')
        .map(t => ({
          id: t.id,
          wager_id: (t as any).wager_id || '',
          amount: Math.abs(t.amount),
          created_at: t.created_at,
        }));
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
          const totalPool = entries.reduce((sum, e) => sum + e.amount, 0);
          commissions += totalPool * (wager.fee_percentage || 0.05);
        });

        return {
          date: format(day, "MMM d"),
          fullDate: dayStr,
          deposits: dayTransactions.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0),
          withdrawals: Math.abs(dayTransactions.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0)),
          wagerEntries: Math.abs(dayTransactions.filter(t => t.type === "wager_entry").reduce((sum, t) => sum + t.amount, 0)),
          wagerWins: dayTransactions.filter(t => t.type === "wager_win").reduce((sum, t) => sum + t.amount, 0),
          commissions,
          transactions: dayTransactions.length,
        };
      });

      setDailyData(daily);

      // Calculate financial metrics
      const totalWagerVolume = (entriesData || []).reduce((sum, e) => sum + e.amount, 0);
      const resolvedWagers = (wagersData || []).filter(w => w.status === "RESOLVED" || w.status === "SETTLED");
      
      let totalCommissions = 0;
      resolvedWagers.forEach(wager => {
        const entries = (entriesData || []).filter(e => e.wager_id === wager.id);
        const totalPool = entries.reduce((sum, e) => sum + e.amount, 0);
        totalCommissions += totalPool * (wager.fee_percentage || 0.05);
      });

      const totalDeposits = (transactionsData || []).filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0);
      const totalWithdrawals = Math.abs((transactionsData || []).filter(t => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0));
      const totalWagerWins = (transactionsData || []).filter(t => t.type === "wager_win").reduce((sum, t) => sum + t.amount, 0);
      const totalWagerRefunds = (transactionsData || []).filter(t => t.type === "wager_refund").reduce((sum, t) => sum + t.amount, 0);

      const metrics: FinancialMetrics = {
        totalRevenue: totalCommissions,
        totalCommissions,
        totalPayouts: totalWagerWins + totalWagerRefunds + totalWithdrawals,
        netProfit: totalCommissions - (totalWagerWins + totalWagerRefunds),
        averageCommissionRate: resolvedWagers.length > 0
          ? resolvedWagers.reduce((sum, w) => sum + (w.fee_percentage || 0.05), 0) / resolvedWagers.length
          : 0.05,
      };

      setFinancialMetrics(metrics);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data.",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast, dateRange, startDate, endDate, customDateRange, getDateFilter]);

  useEffect(() => {
    checkAdmin().then(() => {
      setLoading(false);
    });
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, fetchData]);

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

  // Prepare chart data
  const transactionTypeData = [
    { name: "Deposits", value: financialMetrics ? transactions.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0) : 0 },
    { name: "Withdrawals", value: financialMetrics ? Math.abs(transactions.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0)) : 0 },
    { name: "Wager Entries", value: financialMetrics ? Math.abs(transactions.filter(t => t.type === "wager_entry").reduce((sum, t) => sum + t.amount, 0)) : 0 },
    { name: "Wager Wins", value: financialMetrics ? transactions.filter(t => t.type === "wager_win").reduce((sum, t) => sum + t.amount, 0) : 0 },
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

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <div className="flex gap-2 flex-wrap">
                {(["week", "month", "3months", "all"] as const).map((range) => (
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
                    {range === "3months" ? "3 Months" : range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            </div>
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
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setDateRange("month");
                  setStartDate("");
                  setEndDate("");
                  setCustomDateRange(false);
                }}
                variant="outline"
                size="sm"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        {financialMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                    {formatCurrency(financialMetrics.totalRevenue, DEFAULT_CURRENCY as Currency)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Platform Commissions</p>
                  <p className="text-2xl font-bold mt-1 text-primary">
                    {formatCurrency(financialMetrics.totalCommissions, DEFAULT_CURRENCY as Currency)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Payouts</p>
                  <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
                    {formatCurrency(financialMetrics.totalPayouts, DEFAULT_CURRENCY as Currency)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Profit</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    financialMetrics.netProfit >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(financialMetrics.netProfit, DEFAULT_CURRENCY as Currency)}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
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

