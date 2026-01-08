"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Brain, TrendingUp, DollarSign, Zap, CheckCircle, XCircle, BarChart3, PieChart } from "lucide-react";
import { useAdmin } from "@/contexts/admin-context";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { apiGet } from "@/lib/api-client";

interface AIMetrics {
  period: {
    start: string | null;
    end: string | null;
  };
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    generation: {
      count: number;
      totalWagersGenerated: number;
      categoryDistribution: Record<string, number>;
    };
    settlement: {
      count: number;
      successCount: number;
    };
    successRate: number;
    modelUsage: Record<string, { count: number; tokens: number; cost: number }>;
  };
  recent: Array<{
    id: string;
    request_type: string;
    model: string;
    total_tokens: number;
    estimated_cost: number;
    success: boolean;
    processing_time_ms: number;
    wagers_generated?: number;
    winning_side?: string | null;
    confidence?: number | null;
    created_at: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function AdminAIMetricsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateRange, setDateRange] = useState<"week" | "month" | "3months" | "all" | "custom">("month");
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
      case "custom":
        if (startDate && endDate) {
          start = parseISO(startDate);
          end = parseISO(endDate);
        } else {
          return null;
        }
        break;
      default:
        return null;
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }, [dateRange, startDate, endDate]);

  const fetchMetrics = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      const dateFilter = getDateFilter();
      
      let url = '/admin/ai-metrics';
      if (dateFilter) {
        url += `?startDate=${encodeURIComponent(dateFilter.start)}&endDate=${encodeURIComponent(dateFilter.end)}`;
      }

      const response = await apiGet<{ success: boolean; data: AIMetrics }>(`/api${url}`);
      
      if (response.success && response.data) {
        setMetrics(response.data);
      } else {
        throw new Error('Failed to fetch AI metrics');
      }
    } catch (error) {
      logger.error("Error fetching AI metrics", error);
      toast({
        title: "Error",
        description: "Failed to fetch AI metrics.",
        variant: "destructive",
      });
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast, getDateFilter]);

  useEffect(() => {
    if (isAdmin) {
      fetchMetrics();
    }
  }, [isAdmin, fetchMetrics]);

  // Prepare chart data
  const modelUsageData = metrics?.summary.modelUsage
    ? Object.entries(metrics.summary.modelUsage).map(([model, data]) => ({
        model,
        tokens: data.tokens,
        cost: parseFloat(data.cost.toFixed(4)),
        count: data.count,
      }))
    : [];

  const categoryData = metrics?.summary.generation.categoryDistribution
    ? Object.entries(metrics.summary.generation.categoryDistribution).map(([category, count]) => ({
        category,
        count,
      }))
    : [];

  const requestTypeData = metrics
    ? [
        { type: 'Generation', count: metrics.summary.generation.count, color: '#0088FE' },
        { type: 'Settlement', count: metrics.summary.settlement.count, color: '#00C49F' },
      ]
    : [];

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 w-full">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                AI Metrics
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Track AI usage, token consumption, and costs
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Select a date range to filter metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="dateRange">Date Range</Label>
                <Select
                  value={dateRange}
                  onValueChange={(value) => {
                    setDateRange(value as typeof dateRange);
                    setCustomDateRange(value === 'custom');
                  }}
                >
                  <SelectTrigger id="dateRange">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="3months">Last 3 Months</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {customDateRange && (
                <>
                  <div className="flex-1">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="flex items-end">
                <Button onClick={fetchMetrics} disabled={loading}>
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : metrics ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.summary.totalRequests.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.summary.generation.count} generation, {metrics.summary.settlement.count} settlement
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.summary.totalTokens.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average: {metrics.summary.totalRequests > 0 
                      ? Math.round(metrics.summary.totalTokens / metrics.summary.totalRequests).toLocaleString()
                      : 0} per request
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${metrics.summary.totalCost.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average: ${metrics.summary.totalRequests > 0 
                      ? (metrics.summary.totalCost / metrics.summary.totalRequests).toFixed(4)
                      : 0} per request
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.summary.successRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round((metrics.summary.successRate / 100) * metrics.summary.totalRequests)} successful
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Model Usage */}
              <Card>
                <CardHeader>
                  <CardTitle>Model Usage</CardTitle>
                  <CardDescription>Token consumption by model</CardDescription>
                </CardHeader>
                <CardContent>
                  {modelUsageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={modelUsageData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="model" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="tokens" fill="#0088FE" name="Tokens" />
                        <Bar dataKey="count" fill="#00C49F" name="Requests" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Request Types */}
              <Card>
                <CardHeader>
                  <CardTitle>Request Types</CardTitle>
                  <CardDescription>Generation vs Settlement</CardDescription>
                </CardHeader>
                <CardContent>
                  {requestTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={requestTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ type, count, percent }) => `${type}: ${count} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {requestTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Category Distribution */}
            {categoryData.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Category Distribution</CardTitle>
                  <CardDescription>Wagers generated by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" name="Wagers Generated" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Model Cost Breakdown */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Cost Breakdown by Model</CardTitle>
                <CardDescription>Total costs per model</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(metrics.summary.modelUsage).map(([model, data]) => (
                    <div key={model} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{model}</div>
                        <div className="text-sm text-muted-foreground">
                          {data.count} requests • {data.tokens.toLocaleString()} tokens
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">${parseFloat(data.cost.toFixed(4))}</div>
                        <div className="text-sm text-muted-foreground">
                          ${(data.cost / data.count).toFixed(4)} avg
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Last 50 AI requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Model</th>
                        <th className="text-right p-2">Tokens</th>
                        <th className="text-right p-2">Cost</th>
                        <th className="text-right p-2">Time (ms)</th>
                        <th className="text-center p-2">Status</th>
                        <th className="text-left p-2">Details</th>
                        <th className="text-left p-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.recent.map((record) => (
                        <tr key={record.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <Badge variant={record.request_type === 'generation' ? 'default' : 'secondary'}>
                              {record.request_type}
                            </Badge>
                          </td>
                          <td className="p-2 font-mono text-xs">{record.model}</td>
                          <td className="p-2 text-right">{record.total_tokens.toLocaleString()}</td>
                          <td className="p-2 text-right">${parseFloat(record.estimated_cost.toFixed(4))}</td>
                          <td className="p-2 text-right">{record.processing_time_ms}ms</td>
                          <td className="p-2 text-center">
                            {record.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-2 text-xs">
                            {record.request_type === 'generation' && record.wagers_generated && (
                              <span>{record.wagers_generated} wagers</span>
                            )}
                            {record.request_type === 'settlement' && record.winning_side && (
                              <span>Side {record.winning_side.toUpperCase()} ({record.confidence}% confidence)</span>
                            )}
                            {record.request_type === 'settlement' && !record.winning_side && (
                              <span className="text-muted-foreground">Undetermined</span>
                            )}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {format(parseISO(record.created_at), 'MMM d, HH:mm')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No metrics data available</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
