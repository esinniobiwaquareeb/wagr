"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { Shield, User as UserIcon, Lock, Coins, TrendingUp, Calendar, Ban, CheckCircle, ShieldCheck, ShieldAlert, Mail, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/client";
import { apiGet, apiPatch } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  kyc_level?: number | null;
  kyc_level_label?: string | null;
  email_verified?: boolean;
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

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((user) => user.is_admin).length;
    const verified = users.filter((user) => (user.kyc_level || 1) >= 2).length;
    const suspended = users.filter((user) => user.is_suspended).length;
    return [
      { label: 'Total Users', value: total, icon: UsersIcon },
      { label: 'Verified (L2+)', value: verified, icon: ShieldCheck },
      { label: 'Admins', value: admins, icon: Shield },
      { label: 'Suspended', value: suspended, icon: ShieldAlert },
    ];
  }, [users]);

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
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Review user activity, balances, and verification levels across the platform.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border border-border/80">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DataTable
          data={users}
          columns={[
            {
              id: "user",
              header: "User",
              cell: (row) => (
                <div className="flex items-center gap-3 min-w-[220px]">
                  {row.avatar_url ? (
                    <div className="relative h-10 w-10 rounded-full overflow-hidden flex-shrink-0">
                      <Image
                        src={row.avatar_url}
                        alt={row.username || row.email || "User"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">
                        {row.username || row.email || `User ${row.id.slice(0, 6)}`}
                      </p>
                      {row.is_admin && (
                        <Badge variant="outline" className="text-[11px] flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                      {row.email || "No email"}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{row.kyc_level_label || "Level 1 — Email Verified"}</span>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              id: "wallet",
              header: "Wallet",
              accessorKey: "balance",
              cell: (row) => (
                <div className="text-sm font-medium">
                  {formatCurrency(row.balance || 0, DEFAULT_CURRENCY as Currency)}
                  <p className="text-[11px] text-muted-foreground">
                    Lifetime: {formatCurrency(row.total_wagered || 0, DEFAULT_CURRENCY as Currency)}
                  </p>
                </div>
              ),
            },
            {
              id: "activity",
              header: "Activity",
              cell: (row) => (
                <div className="text-xs text-muted-foreground space-y-0.5 min-w-[140px]">
                  <p className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Wagers: <span className="text-foreground font-semibold">{row.wagers_created || 0}</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    Entries: <span className="text-foreground font-semibold">{row.entries_count || 0}</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(row.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              ),
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => (
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={row.is_suspended ? "destructive" : "secondary"}
                    className="text-[11px] flex items-center gap-1"
                  >
                    {row.is_suspended ? (
                      <>
                        <ShieldAlert className="h-3 w-3" /> Suspended
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3" /> Active
                      </>
                    )}
                  </Badge>
                  <Badge
                    variant={row.email_verified ? "outline" : "destructive"}
                    className="text-[11px] flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {row.email_verified ? "Email OK" : "Email Unverified"}
                  </Badge>
                  {row.two_factor_enabled && (
                    <Badge variant="outline" className="text-[11px] flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      2FA
                    </Badge>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleUnsuspendClick(row)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Unsuspend
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleSuspendClick(row)}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Suspend
                      </Button>
                    )
                  )}
                </div>
              ),
            },
          ]}
          searchKeys={["username", "email"] as (keyof User)[]}
          searchPlaceholder="Search by username or email"
          emptyMessage="No users found."
          defaultSort={{ key: "created_at", direction: "desc" }}
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

