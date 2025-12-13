"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/contexts/admin-context";

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


  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Withdrawals</h1>
          <p className="text-muted-foreground">Manage user withdrawal requests</p>
        </div>

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
      </div>
    </main>
  );
}

