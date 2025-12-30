"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAdmin } from "@/contexts/admin-context";
import { DollarSign, Clock, CheckCircle } from "lucide-react";
import { logger } from "@/lib/logger";

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
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const currency = DEFAULT_CURRENCY as Currency;

  const fetchWithdrawals = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { apiGet } = await import('@/lib/api-client');
      const response = await apiGet<{ withdrawals: Withdrawal[] }>('/admin/withdrawals?limit=500');
      setWithdrawals(response.withdrawals || []);
    } catch (error) {
      logger.error("Error fetching withdrawals", error);
      toast({
        title: "Error",
        description: "Failed to fetch withdrawals.",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast]);

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


  // Calculate stats
  const stats = {
    total: withdrawals.length,
    completed: withdrawals.filter(w => w.status === 'completed').length,
    pending: withdrawals.filter(w => w.status === 'pending').length,
    processing: withdrawals.filter(w => w.status === 'processing').length,
    failed: withdrawals.filter(w => w.status === 'failed').length,
    totalAmount: withdrawals.reduce((sum, w) => sum + w.amount, 0),
    pendingAmount: withdrawals.filter(w => w.status === 'pending' || w.status === 'processing').reduce((sum, w) => sum + w.amount, 0),
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Withdrawals</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Review and process user withdrawal requests
          </p>
        </div>

        {/* Stats - Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Total</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <DollarSign className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold">{stats.total.toLocaleString()}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Pending</h3>
              <div className="h-6 w-6 rounded-md bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                <Clock className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="text-base font-bold text-yellow-600 dark:text-yellow-400">{stats.pending.toLocaleString()}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Completed</h3>
              <div className="h-6 w-6 rounded-md bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-base font-bold text-green-600 dark:text-green-400">{stats.completed.toLocaleString()}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Pending Amt</h3>
              <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <DollarSign className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-base font-bold">{formatCurrency(stats.pendingAmount, currency)}</div>
          </div>
        </div>

        {/* Withdrawals Table */}
        <Card className="border border-border/80">
          <CardHeader>
            <CardTitle>All Withdrawals</CardTitle>
            <CardDescription>Review and manage withdrawal requests</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={withdrawals}
              columns={[
            {
              id: "user_id",
              header: "User ID",
              accessorKey: "user_id",
              cell: (row) => (
                <span className="font-mono text-xs">
                  {row.user_id.substring(0, 8)}...
                </span>
              ),
            },
            {
              id: "amount",
              header: "Amount",
              accessorKey: "amount",
              cell: (row) => (
                <span className="font-semibold">
                  {formatCurrency(row.amount, currency)}
                </span>
              ),
            },
            {
              id: "bank_account",
              header: "Bank Account",
              cell: (row) => (
                <div className="text-sm">
                  <p className="font-medium">{row.bank_account?.account_name || 'N/A'}</p>
                  <p className="text-muted-foreground text-xs">
                    {row.bank_account?.account_number || 'N/A'} • {row.bank_account?.bank_code || 'N/A'}
                  </p>
                </div>
              ),
            },
            {
              id: "status",
              header: "Status",
              accessorKey: "status",
              cell: (row) => (
                <div>
                  {getStatusBadge(row.status)}
                  {row.failure_reason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {row.failure_reason}
                    </p>
                  )}
                </div>
              ),
            },
            {
              id: "reference",
              header: "Reference",
              accessorKey: "reference",
              cell: (row) => (
                <span className="font-mono text-xs">
                  {row.reference}
                </span>
              ),
            },
            {
              id: "created_at",
              header: "Created",
              accessorKey: "created_at",
              cell: (row) => (
                <span className="text-sm">
                  {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
                </span>
              ),
            },
            {
              id: "processed_at",
              header: "Processed",
              accessorKey: "processed_at",
              cell: (row) => (
                <span className="text-sm">
                  {row.processed_at
                    ? format(new Date(row.processed_at), "MMM d, yyyy HH:mm")
                    : "-"}
                </span>
              ),
            },
          ]}
              searchable
              searchPlaceholder="Search by user ID, reference, or status..."
              searchKeys={["user_id", "reference", "status"]}
              pagination
              pageSize={20}
              sortable
              defaultSort={{ key: "created_at", direction: "desc" }}
              emptyMessage="No withdrawals found"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

