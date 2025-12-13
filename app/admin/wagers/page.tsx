"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Eye, AlertTriangle, Plus, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { useAdmin } from "@/contexts/admin-context";
import { apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WAGER_CATEGORIES } from "@/lib/constants";
import { Wager } from "@/lib/types/api";

export default function AdminWagersPage() {
  const { toast } = useToast();
  const { admin, isAdmin } = useAdmin();
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

  const fetchWagers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const response = await fetch('/api/admin/wagers', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wagers');
      }

      const data = await response.json();
      if (data.success && data.data?.wagers) {
        // Transform wagers to match expected format
        const transformedWagers = data.data.wagers.map((w: any) => ({
          id: w.id,
          title: w.title,
          description: w.description,
          status: w.status,
          amount: parseFloat(w.amount || 0),
          created_at: w.created_at,
          deadline: w.deadline,
          creator_id: w.creator_id,
          is_system_generated: w.is_system_generated,
          winning_side: w.winning_side,
          category: w.category?.slug || w.category?.label || w.category_id || null,
          side_a: w.side_a,
          side_b: w.side_b,
          currency: w.currency || 'NGN',
          is_public: w.is_public,
        }));
        setWagers(transformedWagers);
      } else {
        setWagers([]);
      }
    } catch (error) {
      console.error("Error fetching wagers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch wagers.",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast]);

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
    
    // Close dialog immediately
    setShowResolveDialog(false);
    setResolving(wagerId);
    try {
      // Call NestJS backend to resolve wager
      const response = await fetch(`/api/admin/wagers/${wagerId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ winningSide }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.message || 'Failed to resolve wager');
      }

      const data = await response.json();
      
      toast({
        title: "Wager resolved",
        description: data.message || "Winning side has been set. The wager will be automatically settled by the system when the deadline passes.",
      });

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
    if (isAdmin) {
      fetchWagers();
    }
  }, [isAdmin, fetchWagers]);

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
    <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Wagers</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Manage and monitor all wagers on the platform
              </p>
            </div>
          </div>
        </div>
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
        
        {/* Actions Bar */}
        <div className="flex items-center justify-between">
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

        {/* Wagers Table */}
        <Card className="border border-border/80">
          <CardHeader>
            <CardTitle>All Wagers</CardTitle>
            <CardDescription>View and manage wagers across the platform</CardDescription>
          </CardHeader>
          <CardContent>
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
                    href={`/admin/wagers/${row.id}`}
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
                  {typeof row.category === 'object' && row.category !== null
                    ? row.category.slug || row.category.label || "N/A"
                    : row.category_id || "N/A"}
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
                    href={`/admin/wagers/${row.id}`}
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
          </CardContent>
        </Card>
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
        category: typeof wager.category === 'object' && wager.category !== null
          ? wager.category.slug || wager.category.id || ""
          : wager.category_id || "",
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

