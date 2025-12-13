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
  Clock
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  totalUsers: number;
  totalWagers: number;
  openWagers: number;
  resolvedWagers: number;
  totalTransactions: number;
  totalVolume: number;
}

interface Wager {
  id: string;
  title: string;
  status: string;
  amount: number;
  created_at: string;
  deadline: string | null;
  creator_id: string | null;
  is_system_generated: boolean;
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

  const fetchStats = useCallback(async () => {
    if (!admin?.id) return;

    try {
      const response = await apiGet<{ stats: Stats }>('/admin/stats');
      setStats(response.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({
        title: "Error",
        description: "Failed to load statistics.",
        variant: "destructive",
      });
    }
  }, [admin?.id, toast]);

  const fetchRecentWagers = useCallback(async () => {
    if (!admin?.id) return;

    try {
      const response = await apiGet<{ wagers: Wager[] }>('/wagers?limit=10');
      setRecentWagers(response.wagers || []);
    } catch (error) {
      console.error("Error fetching recent wagers:", error);
    }
  }, [admin?.id]);

  const fetchRecentTransactions = useCallback(async () => {
    if (!admin?.id) return;

    try {
      const response = await apiGet<{ transactions: Transaction[] }>('/admin/transactions?limit=20');
      setRecentTransactions(response.transactions || []);
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
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
      console.error("Error resolving wager:", error);
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
      // Fetch data in parallel for better performance
      Promise.all([
        fetchStats(),
        fetchRecentWagers(),
        fetchRecentTransactions(),
      ]).catch((error) => {
        console.error("Error fetching admin data:", error);
      });
    }
  }, [admin?.id, fetchStats, fetchRecentWagers, fetchRecentTransactions]);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 w-full">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl md:text-4xl font-bold">Admin Center</h1>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              ← Back to App
            </Link>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">Manage wagers, users, and system</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-4 md:mb-6">
            <Card className="border border-border/80 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.totalUsers.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Wagers</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.totalWagers.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Wagers</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.openWagers.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.resolvedWagers.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Volume</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {formatCurrency(stats.totalVolume, DEFAULT_CURRENCY as Currency)}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.totalTransactions.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Recent Wagers */}
          <Card className="border border-border/80">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm md:text-base font-semibold">Recent Wagers</h2>
              <Link
                href="/admin/wagers"
                className="text-xs text-primary hover:underline"
              >
                View All →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentWagers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                        No wagers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentWagers.map((wager) => (
                      <TableRow key={wager.id}>
                        <TableCell className="font-medium max-w-xs">
                          <Link
                            href={`/wager/${wager.id}`}
                            className="hover:text-primary transition line-clamp-1 text-xs"
                          >
                            {wager.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded ${
                              wager.status === "OPEN"
                                ? "bg-green-500/20 text-green-700 dark:text-green-400"
                                : "bg-blue-500/20 text-blue-700 dark:text-blue-400"
                            }`}
                          >
                            {wager.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatCurrency(wager.amount, DEFAULT_CURRENCY as Currency)}
                        </TableCell>
                        <TableCell>
                          {wager.status === "OPEN" && wager.deadline && new Date(wager.deadline) <= new Date() && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleResolveWager(wager.id, "a")}
                                disabled={resolving === wager.id}
                                className="px-2 py-1 text-[10px] bg-primary/10 text-primary rounded hover:bg-primary/20 transition disabled:opacity-50"
                                title="Resolve Side A"
                              >
                                {resolving === wager.id ? "..." : "A"}
                              </button>
                              <button
                                onClick={() => handleResolveWager(wager.id, "b")}
                                disabled={resolving === wager.id}
                                className="px-2 py-1 text-[10px] bg-primary/10 text-primary rounded hover:bg-primary/20 transition disabled:opacity-50"
                                title="Resolve Side B"
                              >
                                {resolving === wager.id ? "..." : "B"}
                              </button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className="border border-border/80">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm md:text-base font-semibold">Recent Transactions</h2>
              <Link
                href="/admin/transactions"
                className="text-xs text-primary hover:underline"
              >
                View All →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTransactions.map((trans) => (
                      <TableRow key={trans.id}>
                        <TableCell className="text-xs font-medium capitalize">
                          {trans.type.replace("_", " ")}
                        </TableCell>
                        <TableCell>
                          <p
                            className={`text-xs font-semibold ${
                              trans.amount > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {trans.amount > 0 ? "+" : ""}
                            {formatCurrency(Math.abs(trans.amount), DEFAULT_CURRENCY as Currency)}
                          </p>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {format(new Date(trans.created_at), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

