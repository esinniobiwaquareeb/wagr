"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  CheckCircle, 
  XCircle,
  Clock,
  Eye
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
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentWagers, setRecentWagers] = useState<Wager[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

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

    if (error) {
      console.error("Error checking admin status:", error);
      router.push("/admin/login");
      return;
    }

    if (!profile?.is_admin) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      router.push("/admin/login");
      return;
    }

    setIsAdmin(true);
  }, [supabase, router, toast]);

  const fetchStats = useCallback(async (force = false) => {
    if (!isAdmin) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cached = cache.get<Stats>(CACHE_KEYS.ADMIN_STATS);
      
      if (cached) {
        setStats(cached);
        
        // Check if cache is stale - refresh in background if needed
        const cacheEntry = cache.memoryCache.get(CACHE_KEYS.ADMIN_STATS);
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.ADMIN_DATA / 2;
          
          if (age > staleThreshold) {
            fetchStats(true).catch(() => {});
          }
        }
        return;
      }
    }

    try {
      // Get total users
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get wager stats
      const { data: wagersData } = await supabase
        .from("wagers")
        .select("status, amount");

      const openWagers = wagersData?.filter(w => w.status === "OPEN").length || 0;
      const resolvedWagers = wagersData?.filter(w => w.status === "RESOLVED").length || 0;

      // Get transaction stats
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("amount, type");

      const totalVolume = transactionsData
        ?.filter(t => t.type === "deposit" || t.type === "wager_join")
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

      const statsData: Stats = {
        totalUsers: userCount || 0,
        totalWagers: wagersData?.length || 0,
        openWagers,
        resolvedWagers,
        totalTransactions: transactionsData?.length || 0,
        totalVolume,
      };

      setStats(statsData);
      
      // Cache the results
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      cache.set(CACHE_KEYS.ADMIN_STATS, statsData, CACHE_TTL.ADMIN_DATA);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [supabase, isAdmin]);

  const fetchRecentWagers = useCallback(async (force = false) => {
    if (!isAdmin) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cached = cache.get<Wager[]>(CACHE_KEYS.ADMIN_WAGERS);
      
      if (cached) {
        setRecentWagers(cached);
        
        // Check if cache is stale - refresh in background if needed
        const cacheEntry = cache.memoryCache.get(CACHE_KEYS.ADMIN_WAGERS);
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.ADMIN_DATA / 2;
          
          if (age > staleThreshold) {
            fetchRecentWagers(true).catch(() => {});
          }
        }
        return;
      }
    }

    const { data } = await supabase
      .from("wagers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setRecentWagers(data);
      
      // Cache the results
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      cache.set(CACHE_KEYS.ADMIN_WAGERS, data, CACHE_TTL.ADMIN_DATA);
    }
  }, [supabase, isAdmin]);

  const fetchRecentTransactions = useCallback(async (force = false) => {
    if (!isAdmin) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cached = cache.get<Transaction[]>(CACHE_KEYS.ADMIN_TRANSACTIONS);
      
      if (cached) {
        setRecentTransactions(cached);
        
        // Check if cache is stale - refresh in background if needed
        const cacheEntry = cache.memoryCache.get(CACHE_KEYS.ADMIN_TRANSACTIONS);
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.ADMIN_DATA / 2;
          
          if (age > staleThreshold) {
            fetchRecentTransactions(true).catch(() => {});
          }
        }
        return;
      }
    }

    const { data } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setRecentTransactions(data);
      
      // Cache the results
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      cache.set(CACHE_KEYS.ADMIN_TRANSACTIONS, data, CACHE_TTL.ADMIN_DATA);
    }
  }, [supabase, isAdmin]);

  const handleResolveWager = async (wagerId: string, winningSide: "a" | "b") => {
    if (!isAdmin) return;

    setResolving(wagerId);
    try {
      // Update wager with winning side
      const { error } = await supabase
        .from("wagers")
        .update({ 
          winning_side: winningSide,
          status: "OPEN" // Keep as OPEN so settlement function can process it
        })
        .eq("id", wagerId);

      if (error) throw error;

      // Trigger settlement
      await supabase.rpc("settle_wager", { wager_id_param: wagerId });

      toast({
        title: "Wager resolved",
        description: "Wager has been resolved and settled.",
      });

      // Invalidate cache and refresh
      const { cache, CACHE_KEYS } = await import('@/lib/cache');
      cache.remove(CACHE_KEYS.ADMIN_WAGERS);
      cache.remove(CACHE_KEYS.ADMIN_STATS);
      fetchRecentWagers(true);
      fetchStats(true);
    } catch (error) {
      console.error("Error resolving wager:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resolve wager.",
        variant: "destructive",
      });
    } finally {
      setResolving(null);
    }
  };

  useEffect(() => {
    checkAdmin().then(() => {
      setLoading(false);
    });
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchRecentWagers();
      fetchRecentTransactions();
    }
  }, [isAdmin, fetchStats, fetchRecentWagers, fetchRecentTransactions]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Redirecting to admin login...</p>
          <Link
            href="/admin/login"
            className="text-primary hover:underline"
          >
            Go to Admin Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Total Users</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">{stats.totalUsers}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Total Wagers</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">{stats.totalWagers}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Open Wagers</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">{stats.openWagers}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Resolved</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">{stats.resolvedWagers}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Total Volume</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">
                {formatCurrency(stats.totalVolume, DEFAULT_CURRENCY as Currency)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] md:text-xs text-muted-foreground">Transactions</p>
              </div>
              <p className="text-lg md:text-2xl font-bold">{stats.totalTransactions}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Recent Wagers */}
          <div className="bg-card border border-border rounded-lg p-3 md:p-4">
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
          </div>

          {/* Recent Transactions */}
          <div className="bg-card border border-border rounded-lg p-3 md:p-4">
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
          </div>
        </div>
      </div>
    </main>
  );
}

