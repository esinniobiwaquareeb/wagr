"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Eye, AlertTriangle, Plus, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { getCurrentUser } from "@/lib/auth/client";
import { apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WAGER_CATEGORIES } from "@/lib/constants";

interface Wager {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  amount: number;
  created_at: string;
  deadline: string | null;
  creator_id: string | null;
  is_system_generated: boolean;
  winning_side: string | null;
  category: string | null;
  currency?: string;
  side_a: string;
  side_b: string;
  is_public?: boolean;
}

export default function AdminWagersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "user" | "system">("all");
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [selectedWager, setSelectedWager] = useState<{ id: string; title: string; sideA: string; sideB: string; side: "a" | "b" | null } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingWager, setEditingWager] = useState<Wager | null>(null);
  const [deletingWager, setDeletingWager] = useState<Wager | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const fetchWagers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from("wagers")
        .select("id, title, description, status, amount, created_at, deadline, creator_id, is_system_generated, winning_side, category, side_a, side_b, currency, is_public")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWagers(data || []);
    } catch (error) {
      console.error("Error fetching wagers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch wagers.",
        variant: "destructive",
      });
    }
  }, [supabase, isAdmin, toast]);

  const handleResolveClick = (wager: Wager, side: "a" | "b") => {
    setSelectedWager({
      id: wager.id,
      title: wager.title,
      sideA: wager.side_a,
      sideB: wager.side_b,
      side: side,
    });
    setShowResolveDialog(true);
  };

  const handleResolveWager = async () => {
    if (!isAdmin || !selectedWager || !selectedWager.side) return;

    const wagerId = selectedWager.id;
    const winningSide = selectedWager.side;
    const wagerTitle = selectedWager.title;
    const wagerSideA = selectedWager.sideA;
    const wagerSideB = selectedWager.sideB;
    
    // Close dialog immediately
    setShowResolveDialog(false);
    setResolving(wagerId);
    try {
      // First, fetch the wager to check the deadline
      const { data: wagerData, error: fetchError } = await supabase
        .from("wagers")
        .select("deadline")
        .eq("id", wagerId)
        .single();

      if (fetchError) throw fetchError;
      if (!wagerData) throw new Error("Wager not found");

      // Check if deadline has passed
      if (wagerData.deadline) {
        const deadline = new Date(wagerData.deadline);
        const now = new Date();
        
        if (deadline > now) {
          toast({
            title: "Cannot settle wager",
            description: `The deadline for this wager has not passed yet. Deadline: ${format(deadline, "MMM d, yyyy 'at' HH:mm")}. You can only settle wagers after their deadline.`,
            variant: "destructive",
          });
          setResolving(null);
          return;
        }
      }

      // First, set the winning side
      const { error: updateError } = await supabase
        .from("wagers")
        .update({ 
          winning_side: winningSide
        })
        .eq("id", wagerId);

      if (updateError) throw updateError;

      // Immediately settle the wager using the database function
      // Note: settle_wager returns void, so we check for errors
      try {
        const { data: settleData, error: settleError } = await supabase.rpc("settle_wager", {
          wager_id_param: wagerId
        });

        // Wait a moment for the settlement to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify the wager status was updated
        const { data: updatedWager, error: checkError } = await supabase
          .from("wagers")
          .select("status, winning_side")
          .eq("id", wagerId)
          .single();

        if (settleError) {
          // If RPC call returned an error
          const errorMessage = settleError.message || JSON.stringify(settleError) || 'Unknown error';
          console.error("Error settling wager (RPC error):", {
            error: settleError,
            message: settleError.message,
            details: settleError.details,
            hint: settleError.hint,
            code: settleError.code,
            wagerId,
            fullError: JSON.stringify(settleError, Object.getOwnPropertyNames(settleError))
          });
          
          toast({
            title: "Winning side set",
            description: `Winning side has been set. Settlement will be processed automatically. Error: ${errorMessage}`,
            variant: "default",
          });
        } else if (updatedWager?.status === "SETTLED" || updatedWager?.status === "RESOLVED") {
          // Success - wager was settled
          toast({
            title: "Wager resolved",
            description: "Wager has been resolved and settled. Winnings have been distributed to participants.",
          });
        } else if (updatedWager?.winning_side === winningSide) {
          // Winning side was set but settlement didn't complete yet
          // This might happen if the function returns early or has issues
          toast({
            title: "Winning side set",
            description: "Winning side has been set. Settlement will be processed automatically on the next cron run.",
            variant: "default",
          });
        } else {
          // Unexpected state
          console.warn("Unexpected wager state after settlement attempt:", updatedWager);
          toast({
            title: "Winning side set",
            description: "Winning side has been set. Please verify the wager status.",
            variant: "default",
          });
        }
      } catch (rpcError: any) {
        // Catch any errors from the RPC call
        console.error("Exception during settlement:", rpcError);
        toast({
          title: "Winning side set",
          description: `Winning side has been set. Settlement encountered an error: ${rpcError?.message || 'Unknown error'}. It will be processed automatically.`,
          variant: "default",
        });
      }

      // Refresh wagers list
      fetchWagers();
    } catch (error) {
      console.error("Error resolving wager:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resolve wager.",
        variant: "destructive",
      });
    } finally {
      setResolving(null);
      setSelectedWager(null);
    }
  };

  const handleCreateWager = async (formData: any) => {
    setSubmitting(true);
    try {
      await apiPost('/admin/wagers', formData);
      toast({
        title: "Success",
        description: "Wager created successfully",
      });
      setShowCreateModal(false);
      fetchWagers();
    } catch (error) {
      console.error("Error creating wager:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create wager",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditWager = async (formData: any) => {
    if (!editingWager) return;
    setSubmitting(true);
    try {
      await apiPatch(`/admin/wagers/${editingWager.id}`, formData);
      toast({
        title: "Success",
        description: "Wager updated successfully",
      });
      setShowEditModal(false);
      setEditingWager(null);
      fetchWagers();
    } catch (error) {
      console.error("Error updating wager:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update wager",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWager = async () => {
    if (!deletingWager) return;
    setSubmitting(true);
    try {
      await apiDelete(`/admin/wagers/${deletingWager.id}`);
      toast({
        title: "Success",
        description: "Wager deleted successfully",
      });
      setShowDeleteDialog(false);
      setDeletingWager(null);
      fetchWagers();
    } catch (error) {
      console.error("Error deleting wager:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete wager",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (wager: Wager) => {
    setEditingWager(wager);
    setShowEditModal(true);
  };

  const handleDeleteClick = (wager: Wager) => {
    setDeletingWager(wager);
    setShowDeleteDialog(true);
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
      fetchWagers();
    }
  }, [isAdmin, fetchWagers]);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
            <Clock className="h-3 w-3" />
            Open
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs">
            <CheckCircle className="h-3 w-3" />
            Resolved
          </span>
        );
      case "SETTLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
            <CheckCircle className="h-3 w-3" />
            Settled
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">
            <XCircle className="h-3 w-3" />
            Refunded
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">{status}</span>;
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <ConfirmDialog
        open={showResolveDialog && selectedWager !== null}
        onOpenChange={(open) => {
          setShowResolveDialog(open);
          if (!open) {
            setSelectedWager(null);
          }
        }}
        title="Resolve Wager"
        description={
          selectedWager ? (
            <div className="space-y-3 mt-2">
              <p className="font-semibold text-foreground">{selectedWager.title}</p>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">You are about to resolve this wager with:</p>
                <div className="p-3 rounded-lg border-2 bg-primary/10 border-primary">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary">
                      {selectedWager.side === "a" ? "Side A" : "Side B"}:
                    </span>
                    <span className="text-sm font-medium">
                      {selectedWager.side === "a" ? selectedWager.sideA : selectedWager.sideB}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>⚠️ This action will:</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>Immediately settle the wager</li>
                    <li>Distribute winnings to participants</li>
                    <li>Mark the wager as RESOLVED</li>
                    <li>This cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            ""
          )
        }
        confirmText={selectedWager ? (selectedWager.side === "a" ? `Resolve: ${selectedWager.sideA}` : `Resolve: ${selectedWager.sideB}`) : "Confirm"}
        cancelText="Cancel"
        variant="default"
        onConfirm={handleResolveWager}
      />
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Wagers</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage all wagers in the system</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition"
            >
              <Plus className="h-4 w-4" />
              Create Wager
            </button>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterType === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("user")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterType === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              User Created
            </button>
            <button
              onClick={() => setFilterType("system")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterType === "system"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              System Generated
            </button>
          </div>
        </div>

        <DataTable
          data={wagers.filter(w => {
            if (filterType === "user") return !w.is_system_generated;
            if (filterType === "system") return w.is_system_generated;
            return true;
          })}
          columns={[
            {
              id: "title",
              header: "Title",
              accessorKey: "title",
              cell: (row) => (
                <div className="font-medium max-w-xs">
                  <Link
                    href={`/wager/${row.id}`}
                    className="hover:text-primary transition line-clamp-1"
                  >
                    {row.title}
                  </Link>
                  {row.is_system_generated && (
                    <span className="ml-2 text-xs text-muted-foreground">(System)</span>
                  )}
                </div>
              ),
            },
            {
              id: "status",
              header: "Status",
              accessorKey: "status",
              cell: (row) => getStatusBadge(row.status),
            },
            {
              id: "amount",
              header: "Amount",
              accessorKey: "amount",
              cell: (row) => formatCurrency(row.amount, DEFAULT_CURRENCY as Currency),
            },
            {
              id: "sides",
              header: "Sides",
              cell: (row) => (
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-muted-foreground">A:</span>
                    <span className="truncate max-w-[120px]">{row.side_a}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-muted-foreground">B:</span>
                    <span className="truncate max-w-[120px]">{row.side_b}</span>
                  </div>
                </div>
              ),
            },
            {
              id: "category",
              header: "Category",
              accessorKey: "category",
              cell: (row) => (
                <span className="text-xs text-muted-foreground capitalize">
                  {row.category || "N/A"}
                </span>
              ),
            },
            {
              id: "deadline",
              header: "Deadline",
              accessorKey: "deadline",
              cell: (row) => (
                <span className="text-sm text-muted-foreground">
                  {row.deadline ? format(new Date(row.deadline), "MMM d, HH:mm") : "N/A"}
                </span>
              ),
            },
            {
              id: "created_at",
              header: "Created",
              accessorKey: "created_at",
              cell: (row) => (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(row.created_at), "MMM d, yyyy")}
                </span>
              ),
            },
            {
              id: "resolve",
              header: "Resolve",
              cell: (row) => {
                if (row.status !== "OPEN" || row.is_system_generated) {
                  return <span className="text-xs text-muted-foreground">—</span>;
                }
                return (
                  <div className="flex flex-col gap-1 min-w-[140px]">
                    <button
                      onClick={() => handleResolveClick(row, "a")}
                      disabled={resolving === row.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-green-500/10 text-green-700 dark:text-green-400 rounded hover:bg-green-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title={`Resolve as: ${row.side_a}`}
                    >
                      {resolving === row.id ? (
                        <span>Processing...</span>
                      ) : (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Side A</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleResolveClick(row, "b")}
                      disabled={resolving === row.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title={`Resolve as: ${row.side_b}`}
                    >
                      {resolving === row.id ? (
                        <span>Processing...</span>
                      ) : (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Side B</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              },
            },
            {
              id: "actions",
              header: "Actions",
              cell: (row) => (
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/wager/${row.id}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition"
                    title="View Wager"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View</span>
                  </Link>
                  {row.status === "OPEN" && (
                    <>
                      <button
                        onClick={() => handleEditClick(row)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-500/20 transition"
                        title="Edit Wager"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(row)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-red-500/10 text-red-700 dark:text-red-400 rounded hover:bg-red-500/20 transition"
                        title="Delete Wager"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          searchable
          searchPlaceholder="Search by title, category, or sides..."
          searchKeys={["title", "category", "side_a", "side_b"]}
          pagination
          pageSize={20}
          sortable
          defaultSort={{ key: "created_at", direction: "desc" }}
          emptyMessage="No wagers found"
        />
      </div>

      {/* Create Wager Modal */}
      <AdminWagerModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={handleCreateWager}
        submitting={submitting}
      />

      {/* Edit Wager Modal */}
      {editingWager && (
        <AdminWagerModal
          open={showEditModal}
          onOpenChange={(open) => {
            setShowEditModal(open);
            if (!open) setEditingWager(null);
          }}
          onSubmit={handleEditWager}
          submitting={submitting}
          wager={editingWager}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingWager && (
        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Wager"
          description={`Are you sure you want to delete "${deletingWager.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={handleDeleteWager}
        />
      )}
    </main>
  );
}

// Admin Wager Modal Component
function AdminWagerModal({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  wager,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  submitting: boolean;
  wager?: Wager | null;
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    sideA: "",
    sideB: "",
    deadline: "",
    category: "",
    currency: "NGN",
    isPublic: true,
    isSystemGenerated: false,
  });

  useEffect(() => {
    if (wager) {
      setFormData({
        title: wager.title || "",
        description: wager.description || "",
        amount: wager.amount?.toString() || "",
        sideA: wager.side_a || "",
        sideB: wager.side_b || "",
        deadline: wager.deadline ? new Date(wager.deadline).toISOString().slice(0, 16) : "",
        category: wager.category || "",
        currency: wager.currency || "NGN",
        isPublic: wager.is_public ?? true,
        isSystemGenerated: wager.is_system_generated || false,
      });
    } else if (!open) {
      setFormData({
        title: "",
        description: "",
        amount: "",
        sideA: "",
        sideB: "",
        deadline: "",
        category: "",
        currency: "NGN",
        isPublic: true,
        isSystemGenerated: false,
      });
    }
  }, [wager, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{wager ? "Edit Wager" : "Create Wager"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              minLength={5}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Amount *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                min="1"
                step="0.01"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background"
              >
                <option value="NGN">NGN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Side A *</label>
            <input
              type="text"
              value={formData.sideA}
              onChange={(e) => setFormData({ ...formData, sideA: e.target.value })}
              required
              className="w-full px-4 py-2 border border-input rounded-lg bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Side B *</label>
            <input
              type="text"
              value={formData.sideB}
              onChange={(e) => setFormData({ ...formData, sideB: e.target.value })}
              required
              className="w-full px-4 py-2 border border-input rounded-lg bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Deadline *</label>
              <input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                required
                className="w-full px-4 py-2 border border-input rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background"
              >
                <option value="">Select category</option>
                {WAGER_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Public</span>
            </label>
            {!wager && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isSystemGenerated}
                  onChange={(e) => setFormData({ ...formData, isSystemGenerated: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">System Generated</span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? "Saving..." : wager ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

