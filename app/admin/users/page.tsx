"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { Shield, User as UserIcon, Lock, Coins, TrendingUp, Calendar, Ban, CheckCircle } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/client";
import { apiGet, apiPatch } from "@/lib/api-client";

interface User {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  balance: number;
  is_admin: boolean;
  two_factor_enabled?: boolean;
  is_suspended?: boolean;
  suspended_at?: string | null;
  suspension_reason?: string | null;
  created_at: string;
  wagers_created?: number;
  entries_count?: number;
  total_wagered?: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showUnsuspendDialog, setShowUnsuspendDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");

  const checkAdmin = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser(true); // Force refresh
      if (!currentUser || !currentUser.is_admin) {
        router.replace("/admin/login");
        return;
      }

      setUser(currentUser);
      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin status:", error);
      router.replace("/admin/login");
    }
  }, [router]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const response = await apiGet<{ users: User[] }>('/admin/users');
      setUsers(response.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users.",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast]);

  const handleSuspendUser = useCallback(async (userId: string, isSuspended: boolean, reason?: string) => {
    if (!isAdmin) return;

    try {
      await apiPatch('/admin/users', {
        userId,
        isSuspended,
        reason,
      });

      toast({
        title: "Success",
        description: isSuspended ? "User account suspended" : "User account unsuspended",
      });

      // Refresh users list
      fetchUsers();
      
      // Close dialogs and reset state
      setShowSuspendDialog(false);
      setShowUnsuspendDialog(false);
      setSelectedUser(null);
      setSuspensionReason("");
    } catch (error) {
      console.error("Error updating user status:", error);
      toast({
        title: "Error",
        description: "Failed to update user status.",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast, fetchUsers]);

  const handleSuspendClick = (user: User) => {
    setSelectedUser(user);
    setSuspensionReason("");
    setShowSuspendDialog(true);
  };

  const handleUnsuspendClick = (user: User) => {
    setSelectedUser(user);
    setShowUnsuspendDialog(true);
  };

  const handleConfirmSuspend = () => {
    if (selectedUser) {
      handleSuspendUser(selectedUser.id, true, suspensionReason.trim() || undefined);
    }
  };

  const handleConfirmUnsuspend = () => {
    if (selectedUser) {
      handleSuspendUser(selectedUser.id, false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    checkAdmin().then(() => {
      if (mounted) {
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

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

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Users</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage all users in the system</p>
        </div>

        <DataTable
          data={users}
          columns={[
            {
              id: "user",
              header: "User",
              cell: (row) => (
                <div className="flex items-center gap-2">
                  {row.avatar_url ? (
                    <div className="relative h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
                      <Image
                        src={row.avatar_url}
                        alt={row.username || row.email || "User"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm truncate">
                      {row.username || row.email || `User ${row.id.slice(0, 8)}`}
                    </span>
                    {row.username && row.email && (
                      <span className="text-xs text-muted-foreground truncate">{row.email}</span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              id: "balance",
              header: "Balance",
              accessorKey: "balance",
              cell: (row) => (
                <div className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{formatCurrency(row.balance || 0, DEFAULT_CURRENCY as Currency)}</span>
                </div>
              ),
            },
            {
              id: "activity",
              header: "Activity",
              cell: (row) => (
                <div className="flex flex-col gap-0.5 text-xs">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span>{row.wagers_created || 0} wagers</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>{row.entries_count || 0} entries</span>
                  </div>
                  {row.total_wagered && row.total_wagered > 0 && (
                    <div className="text-muted-foreground">
                      {formatCurrency(row.total_wagered, DEFAULT_CURRENCY as Currency)} wagered
                    </div>
                  )}
                </div>
              ),
            },
            {
              id: "role",
              header: "Role & Security",
              cell: (row) => (
                <div className="flex flex-col gap-1">
                  {row.is_admin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs w-fit">
                      <Shield className="h-3 w-3" />
                      Admin
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">User</span>
                  )}
                  {row.two_factor_enabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400 text-xs w-fit">
                      <Lock className="h-3 w-3" />
                      2FA
                    </span>
                  )}
                  {row.is_suspended && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-700 dark:text-red-400 text-xs w-fit">
                      <Ban className="h-3 w-3" />
                      Suspended
                    </span>
                  )}
                </div>
              ),
            },
            {
              id: "actions",
              header: "Actions",
              cell: (row) => (
                <div className="flex items-center gap-2">
                  {!row.is_admin && (
                    row.is_suspended ? (
                      <button
                        onClick={() => handleUnsuspendClick(row)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400 text-xs hover:bg-green-500/20 transition"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Unsuspend
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSuspendClick(row)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-700 dark:text-red-400 text-xs hover:bg-red-500/20 transition"
                      >
                        <Ban className="h-3 w-3" />
                        Suspend
                      </button>
                    )
                  )}
                </div>
              ),
            },
            {
              id: "created_at",
              header: "Joined",
              accessorKey: "created_at",
              cell: (row) => (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(row.created_at), "MMM d, yyyy")}</span>
                </div>
              ),
            },
          ]}
          searchable
          searchPlaceholder="Search by email, username..."
          searchKeys={["email", "username"]}
          pagination
          pageSize={20}
          sortable
          defaultSort={{ key: "created_at", direction: "desc" }}
          emptyMessage="No users found"
        />
      </div>

      {/* Suspend Confirmation Dialog */}
      <ConfirmDialog
        open={showSuspendDialog && selectedUser !== null}
        onOpenChange={(open) => {
          setShowSuspendDialog(open);
          if (!open) {
            setSelectedUser(null);
            setSuspensionReason("");
          }
        }}
        title="Suspend User Account"
        description={
          selectedUser ? (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                You are about to suspend the account for <strong>{selectedUser.username || selectedUser.email || 'this user'}</strong>.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Suspension Reason (Optional)</label>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Enter reason for suspension..."
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none"
                  rows={3}
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>⚠️ This action will:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>Immediately log out the user from all sessions</li>
                  <li>Prevent the user from logging in</li>
                  <li>Display a suspension message when they try to access their account</li>
                  <li>Can be reversed by unsuspending the account</li>
                </ul>
              </div>
            </div>
          ) : (
            ""
          )
        }
        confirmText="Suspend Account"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmSuspend}
      />

      {/* Unsuspend Confirmation Dialog */}
      <ConfirmDialog
        open={showUnsuspendDialog && selectedUser !== null}
        onOpenChange={(open) => {
          setShowUnsuspendDialog(open);
          if (!open) {
            setSelectedUser(null);
          }
        }}
        title="Unsuspend User Account"
        description={
          selectedUser ? (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                You are about to unsuspend the account for <strong>{selectedUser.username || selectedUser.email || 'this user'}</strong>.
              </p>
              {selectedUser.suspension_reason && (
                <div className="p-3 rounded-lg border border-border bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Previous Suspension Reason:</p>
                  <p className="text-sm">{selectedUser.suspension_reason}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>✓ This action will:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>Restore the user's access to their account</li>
                  <li>Allow them to log in normally</li>
                  <li>Clear the suspension status</li>
                </ul>
              </div>
            </div>
          ) : (
            ""
          )
        }
        confirmText="Unsuspend Account"
        cancelText="Cancel"
        variant="default"
        onConfirm={handleConfirmUnsuspend}
      />
    </main>
  );
}

