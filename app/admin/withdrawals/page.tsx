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
      console.error("Error fetching withdrawals:", error);
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

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Withdrawals</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Amount</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.pendingAmount, currency)}</div>
            </CardContent>
          </Card>
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

