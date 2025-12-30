"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  CheckCircle, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdmin } from "@/contexts/admin-context";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wager } from "@/lib/types/api";
import { logger } from "@/lib/logger";
import { LucideIcon } from "lucide-react";

interface Stats {
  totalUsers: number;
  totalWagers: number;
  openWagers: number;
  resolvedWagers: number;
  totalTransactions: number;
  totalVolume: number;
}

interface StatCardConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  value: (stats: Stats) => string | number;
  subtitle?: (stats: Stats) => string;
  link?: string;
  iconColor: string;
  iconBg: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  user_id: string;
  description: string | null;
}

export default function AdminPage() {
  const { toast } = useToast();
  const { admin } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentWagers, setRecentWagers] = useState<Wager[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!admin?.id) return;

    try {
      const response = await apiGet<{ stats: Stats }>('/admin/stats');
      setStats(response.stats);
    } catch (error) {
      logger.error("Error fetching stats", error);
      toast({
        title: "Error",
        description: "Failed to load statistics.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [admin?.id, toast]);

  const fetchRecentWagers = useCallback(async () => {
    if (!admin?.id) return;

    try {
      const response = await apiGet<{ wagers: Wager[] }>('/wagers?limit=10');
      setRecentWagers(response.wagers || []);
    } catch (error) {
      logger.error("Error fetching recent wagers", error);
    }
  }, [admin?.id]);

  const fetchRecentTransactions = useCallback(async () => {
    if (!admin?.id) return;

    try {
      const response = await apiGet<{ transactions: Transaction[] }>('/admin/transactions?limit=20');
      setRecentTransactions(response.transactions || []);
    } catch (error) {
      logger.error("Error fetching recent transactions", error);
      toast({
        title: "Error",
        description: "Failed to fetch recent transactions.",
        variant: "destructive",
      });
    }
  }, [admin?.id, toast]);

  const handleResolveWager = async (wagerId: string, winningSide: "a" | "b") => {
    if (!admin?.id) return;

    setResolving(wagerId);
    try {
      const { apiPost } = await import('@/lib/api-client');
      const response = await apiPost<{ message: string }>(`/admin/wagers/${wagerId}/resolve`, {
        winningSide,
      });

      toast({
        title: "Winning side set",
        description: response.message || "Winning side has been set. The wager will be automatically settled by the system when the deadline passes.",
      });

      // Refresh data
      fetchRecentWagers();
      fetchStats();
    } catch (error) {
      logger.error("Error resolving wager", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to resolve wager.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setResolving(null);
    }
  };

  useEffect(() => {
    if (admin?.id) {
      setLoading(true);
      // Fetch data in parallel for better performance
      Promise.all([
        fetchStats(),
        fetchRecentWagers(),
        fetchRecentTransactions(),
      ]).catch((error) => {
        logger.error("Error fetching admin data", error);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [admin?.id, fetchStats, fetchRecentWagers, fetchRecentTransactions]);

  // Stats card configuration
  const statsCards: StatCardConfig[] = [
    {
      id: 'users',
      title: 'Total Users',
      icon: Users,
      value: (s) => s.totalUsers.toLocaleString(),
      link: '/admin/users',
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
    },
    {
      id: 'wagers',
      title: 'Total Wagers',
      icon: TrendingUp,
      value: (s) => s.totalWagers.toLocaleString(),
      link: '/admin/wagers',
      iconColor: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-500/10 group-hover:bg-green-500/20',
    },
    {
      id: 'open',
      title: 'Open Wagers',
      icon: Activity,
      value: (s) => s.openWagers.toLocaleString(),
      subtitle: () => 'Active now',
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-500/10 group-hover:bg-orange-500/20',
    },
    {
      id: 'resolved',
      title: 'Resolved',
      icon: CheckCircle,
      value: (s) => s.resolvedWagers.toLocaleString(),
      subtitle: (s) => s.totalWagers > 0 
        ? `${Math.round((s.resolvedWagers / s.totalWagers) * 100)}% completion`
        : '0% completion',
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-500/10 group-hover:bg-purple-500/20',
    },
    {
      id: 'volume',
      title: 'Total Volume',
      icon: DollarSign,
      value: (s) => formatCurrency(s.totalVolume, DEFAULT_CURRENCY as Currency),
      subtitle: () => 'All-time volume',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
    },
    {
      id: 'transactions',
      title: 'Transactions',
      icon: Activity,
      value: (s) => s.totalTransactions.toLocaleString(),
      link: '/admin/transactions',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-500/10 group-hover:bg-cyan-500/20',
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 w-full">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Welcome back, {admin?.username || admin?.email || 'Admin'}
              </p>
            </div>
            <Link
              href="/"
              className="hidden md:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
            >
              <span>←</span>
              <span>Back to App</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid - Compact */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-border/60 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="h-2.5 w-12 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-5 w-10 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
            {statsCards.map((card) => {
              const Icon = card.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground truncate">{card.title}</span>
                    <div className={`h-5 w-5 rounded ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-2.5 w-2.5 ${card.iconColor}`} />
                    </div>
                  </div>
                  <div className="text-sm font-bold leading-tight truncate">{card.value(stats)}</div>
                  {card.subtitle && (
                    <p className="text-[9px] text-muted-foreground truncate mt-0.5">{card.subtitle(stats)}</p>
                  )}
                </>
              );
              
              const className = "bg-card border border-border/60 rounded-lg p-2 hover:border-primary/40 hover:shadow-sm transition-all group block";
              
              return card.link ? (
                <Link key={card.id} href={card.link} className={className}>
                  {content}
                </Link>
              ) : (
                <div key={card.id} className={className}>
                  {content}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="space-y-6">
          {/* Recent Wagers */}
          <Card className="border border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Recent Wagers</CardTitle>
                  <CardDescription className="text-xs mt-1">Latest wager activity</CardDescription>
                </div>
                <Link
                  href="/admin/wagers"
                  className="text-xs text-primary hover:underline flex items-center gap-1 group"
                >
                  View All <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Title</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && recentWagers.length === 0 ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-6 w-12 bg-muted animate-pulse rounded" /></TableCell>
                        </TableRow>
                      ))
                    ) : recentWagers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Activity className="h-8 w-8 opacity-50" />
                            <p className="text-sm">No wagers found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentWagers.map((wager) => (
                        <TableRow key={wager.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">
                            <Link
                              href={`/admin/wagers/${wager.id}`}
                              className="hover:text-primary transition-colors text-sm line-clamp-1 flex items-center gap-1 group"
                            >
                              {wager.title}
                              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={wager.status === "OPEN" ? "default" : "secondary"}
                              className={`text-xs ${
                                wager.status === "OPEN"
                                  ? "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30"
                                  : "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30"
                              }`}
                            >
                              {wager.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {formatCurrency(wager.amount, DEFAULT_CURRENCY as Currency)}
                          </TableCell>
                          <TableCell>
                            {wager.status === "OPEN" && wager.deadline && new Date(wager.deadline) <= new Date() && (
                              <div className="flex gap-1.5">
                                <Button
                                  onClick={() => handleResolveWager(wager.id, "a")}
                                  disabled={resolving === wager.id}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  title="Resolve Side A"
                                >
                                  {resolving === wager.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "A"
                                  )}
                                </Button>
                                <Button
                                  onClick={() => handleResolveWager(wager.id, "b")}
                                  disabled={resolving === wager.id}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  title="Resolve Side B"
                                >
                                  {resolving === wager.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "B"
                                  )}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="border border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
                  <CardDescription className="text-xs mt-1">Latest transaction activity</CardDescription>
                </div>
                <Link
                  href="/admin/transactions"
                  className="text-xs text-primary hover:underline flex items-center gap-1 group"
                >
                  View All <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && recentTransactions.length === 0 ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                        </TableRow>
                      ))
                    ) : recentTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Activity className="h-8 w-8 opacity-50" />
                            <p className="text-sm">No transactions found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentTransactions.map((trans) => (
                        <TableRow key={trans.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {trans.amount > 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-400" />
                              )}
                              <span className="text-sm font-medium capitalize">
                                {trans.type.replace(/_/g, " ")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-semibold ${
                                trans.amount > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {trans.amount > 0 ? "+" : ""}
                              {formatCurrency(Math.abs(trans.amount), DEFAULT_CURRENCY as Currency)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(trans.created_at), "MMM d, HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

