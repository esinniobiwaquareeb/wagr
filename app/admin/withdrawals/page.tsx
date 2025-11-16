"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  bank_account: {
    account_number: string;
    bank_code: string;
    account_name: string;
  };
  reference: string;
  failure_reason: string | null;
  created_at: string;
  processed_at: string | null;
}

export default function AdminWithdrawals() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const currency = DEFAULT_CURRENCY as Currency;

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/admin/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      router.push("/admin/login");
      return;
    }

    setIsAdmin(true);
  }, [supabase, router]);

  const fetchWithdrawals = useCallback(async (force = false) => {
    if (!isAdmin) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cached = cache.get<Withdrawal[]>(CACHE_KEYS.ADMIN_TRANSACTIONS.replace('admin_transactions', 'admin_withdrawals'));
      
      if (cached) {
        setWithdrawals(cached);
        
        // Check if cache is stale - refresh in background if needed
        const cacheEntry = cache.memoryCache.get(CACHE_KEYS.ADMIN_TRANSACTIONS.replace('admin_transactions', 'admin_withdrawals'));
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.ADMIN_DATA / 2;
          
          if (age > staleThreshold) {
            fetchWithdrawals(true).catch(() => {});
          }
        }
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setWithdrawals(data || []);
      
      // Cache the results
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      cache.set(CACHE_KEYS.ADMIN_TRANSACTIONS.replace('admin_transactions', 'admin_withdrawals'), data || [], CACHE_TTL.ADMIN_DATA);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      toast({
        title: "Error",
        description: "Failed to fetch withdrawals.",
        variant: "destructive",
      });
    }
  }, [supabase, isAdmin, toast]);

  useEffect(() => {
    checkAdmin().then(() => {
      setLoading(false);
    });
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchWithdrawals();
    }
  }, [isAdmin, fetchWithdrawals]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-600">Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-600">Failed</Badge>;
      case 'pending':
        return <Badge className="bg-gray-600">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto p-4 md:p-6 py-12 text-center">
          <p className="text-muted-foreground">Loading withdrawals...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Withdrawals</h1>
          <p className="text-muted-foreground">Manage user withdrawal requests</p>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Bank Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Processed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No withdrawals found
                  </TableCell>
                </TableRow>
              ) : (
                withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="font-mono text-xs">
                      {withdrawal.user_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(withdrawal.amount, currency)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{withdrawal.bank_account?.account_name || 'N/A'}</p>
                        <p className="text-muted-foreground text-xs">
                          {withdrawal.bank_account?.account_number || 'N/A'} • {withdrawal.bank_account?.bank_code || 'N/A'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(withdrawal.status)}
                      {withdrawal.failure_reason && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {withdrawal.failure_reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {withdrawal.reference}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(withdrawal.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {withdrawal.processed_at
                        ? format(new Date(withdrawal.processed_at), "MMM d, yyyy HH:mm")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}

