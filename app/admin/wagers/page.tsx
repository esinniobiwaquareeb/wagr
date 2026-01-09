"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Eye, AlertTriangle, Plus, Edit, Trash2, FileText, TrendingUp, Users, DollarSign, Filter, X, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { useAdmin } from "@/contexts/admin-context";
import { apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { categoriesApi } from "@/lib/api-client";
import { Wager } from "@/lib/types/api";
import { logger } from "@/lib/logger";

export default function AdminWagersPage() {
  const { toast } = useToast();
  const { admin, isAdmin } = useAdmin();
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [categories, setCategories] = useState<Array<{
    id: string;
    slug: string;
    label: string;
  }>>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "user" | "system">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [minParticipants, setMinParticipants] = useState<string>("");
  const [maxParticipants, setMaxParticipants] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [selectedWager, setSelectedWager] = useState<{ id: string; title: string; sideA: string; sideB: string; side: "a" | "b" | null } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingWager, setEditingWager] = useState<Wager | null>(null);
  const [deletingWager, setDeletingWager] = useState<Wager | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isCreatingSystemWager, setIsCreatingSystemWager] = useState(false);

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
          category: w.category || null, // Keep full category object
          category_id: w.category_id || null,
          side_a: w.side_a,
          side_b: w.side_b,
          currency: w.currency || 'NGN',
          is_public: w.is_public,
          // Backend should return participantsCount, but handle both camelCase and snake_case
          // Also ensure we get the value even if it's 0
          participantsCount: typeof w.participantsCount === 'number' 
            ? w.participantsCount 
            : typeof w.participants_count === 'number'
            ? w.participants_count
            : 0,
        }));
        setWagers(transformedWagers);
      } else {
        setWagers([]);
      }
    } catch (error) {
      logger.error("Error fetching wagers", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Failed to fetch wagers. Please try again.");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [isAdmin, toast]);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesApi.list(false);
        if (response && response.categories) {
          const mappedCategories = response.categories
            .filter(cat => cat.is_active)
            .map(cat => ({
              id: cat.slug,
              slug: cat.slug,
              label: cat.label,
            }));
          setCategories(mappedCategories);
        }
      } catch (error) {
        logger.error('Error fetching categories', error);
        setCategories([]);
      }
    };

    fetchCategories();
  }, []);

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
      logger.error("Error resolving wager", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Failed to resolve wager. Please try again.");
      toast({
        title: "Error",
        description: errorMessage,
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
      logger.error("Error creating wager", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Failed to create wager. Please try again.");
      toast({
        title: "Error",
        description: errorMessage,
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
      logger.error("Error updating wager", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Failed to update wager. Please try again.");
      toast({
        title: "Error",
        description: errorMessage,
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
      logger.error("Error deleting wager", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Failed to delete wager. Please try again.");
      toast({
        title: "Error",
        description: errorMessage,
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

  // Filter wagers based on all active filters
  const filteredWagers = useMemo(() => {
    let filtered = [...wagers];

    // Filter by type (user/system/all)
    if (filterType === "user") {
      filtered = filtered.filter(w => !w.is_system_generated);
    } else if (filterType === "system") {
      filtered = filtered.filter(w => w.is_system_generated);
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(w => w.status === statusFilter);
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter(w => {
        const category = (w as any).category;
        const wagerCategory = category && typeof category === 'object'
          ? category.slug || category.id
          : (w as any).category_id;
        return wagerCategory === categoryFilter;
      });
    }

    // Filter by date range
    if (dateRangeFilter !== "all") {
      const now = new Date();
      let startDate: Date;
      
      switch (dateRangeFilter) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case "3months":
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        default:
          startDate = new Date(0);
      }
      
      filtered = filtered.filter(w => {
        const createdDate = new Date(w.created_at);
        return createdDate >= startDate;
      });
    }

    // Filter by participants count
    if (minParticipants) {
      const min = parseInt(minParticipants, 10);
      if (!isNaN(min)) {
        filtered = filtered.filter(w => ((w as any).participantsCount || 0) >= min);
      }
    }
    if (maxParticipants) {
      const max = parseInt(maxParticipants, 10);
      if (!isNaN(max)) {
        filtered = filtered.filter(w => ((w as any).participantsCount || 0) <= max);
      }
    }

    return filtered;
  }, [wagers, filterType, statusFilter, categoryFilter, dateRangeFilter, minParticipants, maxParticipants]);

  // Calculate stats from filtered wagers
  const stats = useMemo(() => {
    return {
      total: filteredWagers.length,
      open: filteredWagers.filter(w => w.status === "OPEN").length,
      resolved: filteredWagers.filter(w => w.status === "RESOLVED").length,
      settled: filteredWagers.filter(w => w.status === "SETTLED").length,
      refunded: filteredWagers.filter(w => w.status === "REFUNDED").length,
      totalVolume: filteredWagers.reduce((sum, w) => sum + (w.amount || 0), 0),
      userCreated: filteredWagers.filter(w => !w.is_system_generated).length,
      systemGenerated: filteredWagers.filter(w => w.is_system_generated).length,
    };
  }, [filteredWagers]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return statusFilter !== "all" || 
           categoryFilter !== "all" || 
           dateRangeFilter !== "all" || 
           minParticipants !== "" || 
           maxParticipants !== "";
  }, [statusFilter, categoryFilter, dateRangeFilter, minParticipants, maxParticipants]);

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setDateRangeFilter("all");
    setMinParticipants("");
    setMaxParticipants("");
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

        {/* Stats Cards - Compact */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Total</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                <FileText className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight">{stats.total.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Open</h3>
              <div className="h-6 w-6 rounded-md bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors flex-shrink-0">
                <Clock className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight text-green-600 dark:text-green-400">{stats.open.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Resolved</h3>
              <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors flex-shrink-0">
                <CheckCircle className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight text-blue-600 dark:text-blue-400">{stats.resolved.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Settled</h3>
              <div className="h-6 w-6 rounded-md bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors flex-shrink-0">
                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight text-green-600 dark:text-green-400">{stats.settled.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Refunded</h3>
              <div className="h-6 w-6 rounded-md bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors flex-shrink-0">
                <XCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight text-yellow-600 dark:text-yellow-400">{stats.refunded.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Total Volume</h3>
              <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors flex-shrink-0">
                <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight truncate">{formatCurrency(stats.totalVolume, DEFAULT_CURRENCY as Currency)}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">User Created</h3>
              <div className="h-6 w-6 rounded-md bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors flex-shrink-0">
                <Users className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight">{stats.userCreated.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">System</h3>
              <div className="h-6 w-6 rounded-md bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
                <TrendingUp className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight">{stats.systemGenerated.toLocaleString()}</div>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
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
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  showFilters || hasActiveFilters
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {[statusFilter !== "all", categoryFilter !== "all", dateRangeFilter !== "all", minParticipants !== "", maxParticipants !== ""].filter(Boolean).length}
                  </Badge>
                )}
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {/* Create Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingWager(null);
                  setIsCreatingSystemWager(false);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Create Wager
              </button>
              <button
                onClick={() => {
                  setEditingWager(null);
                  setIsCreatingSystemWager(true);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Create System Wager
              </button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <Card className="border border-border/80 bg-muted/30">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Advanced Filters
                    </h3>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                      >
                        <X className="h-3 w-3" />
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Status Filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="RESOLVED">Resolved</SelectItem>
                          <SelectItem value="SETTLED">Settled</SelectItem>
                          <SelectItem value="REFUNDED">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Category Filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Category</label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.slug}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range Filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Date Range
                      </label>
                      <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="All Time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">Last 7 Days</SelectItem>
                          <SelectItem value="month">Last 30 Days</SelectItem>
                          <SelectItem value="3months">Last 3 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Participants Filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Participants</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={minParticipants}
                          onChange={(e) => setMinParticipants(e.target.value)}
                          className="h-9"
                          min="0"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={maxParticipants}
                          onChange={(e) => setMaxParticipants(e.target.value)}
                          className="h-9"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Filter Badges */}
                  {hasActiveFilters && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">Active filters:</span>
                      {statusFilter !== "all" && (
                        <Badge variant="secondary" className="text-xs">
                          Status: {statusFilter}
                          <button
                            onClick={() => setStatusFilter("all")}
                            className="ml-1.5 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {categoryFilter !== "all" && (
                        <Badge variant="secondary" className="text-xs">
                          Category: {categories.find(c => c.slug === categoryFilter)?.label || categoryFilter}
                          <button
                            onClick={() => setCategoryFilter("all")}
                            className="ml-1.5 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {dateRangeFilter !== "all" && (
                        <Badge variant="secondary" className="text-xs">
                          Date: {dateRangeFilter === "today" ? "Today" : dateRangeFilter === "week" ? "Last 7 Days" : dateRangeFilter === "month" ? "Last 30 Days" : "Last 3 Months"}
                          <button
                            onClick={() => setDateRangeFilter("all")}
                            className="ml-1.5 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {minParticipants && (
                        <Badge variant="secondary" className="text-xs">
                          Min Participants: {minParticipants}
                          <button
                            onClick={() => setMinParticipants("")}
                            className="ml-1.5 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {maxParticipants && (
                        <Badge variant="secondary" className="text-xs">
                          Max Participants: {maxParticipants}
                          <button
                            onClick={() => setMaxParticipants("")}
                            className="ml-1.5 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Wagers Table */}
        <Card className="border border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Wagers</CardTitle>
                <CardDescription>
                  {filteredWagers.length === wagers.length
                    ? `Showing all ${wagers.length} wagers`
                    : `Showing ${filteredWagers.length} of ${wagers.length} wagers`}
                  {hasActiveFilters && " (filtered)"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredWagers}
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
              cell: (row) => {
                const category = row.category;
                if (category && typeof category === 'object') {
                  return (
                    <span className="text-xs text-muted-foreground capitalize">
                      {category.label || category.slug || "N/A"}
                    </span>
                  );
                }
                // Fallback to category_id if category object is not available
                return (
                  <span className="text-xs text-muted-foreground capitalize">
                    {row.category_id || "N/A"}
                  </span>
                );
              },
            },
            {
              id: "participants",
              header: "Participants",
              cell: (row: any) => {
                const count = typeof row.participantsCount === 'number' 
                  ? row.participantsCount 
                  : typeof row.participants_count === 'number'
                  ? row.participants_count
                  : 0;
                return (
                  <span className="text-sm font-medium text-foreground">
                    {count}
                  </span>
                );
              },
            },
            {
              id: "winning_side",
              header: "Winning Side",
              accessorKey: "winning_side",
              cell: (row) => {
                if (!row.winning_side) {
                  return <span className="text-xs text-muted-foreground">—</span>;
                }
                const side = row.winning_side.toLowerCase();
                const sideText = side === 'a' ? row.side_a : side === 'b' ? row.side_b : row.winning_side;
                return (
                  <div className="flex flex-col gap-0.5">
                    <Badge 
                      variant={side === 'a' ? 'default' : 'secondary'}
                      className={`text-xs w-fit ${
                        side === 'a' 
                          ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                          : 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {row.winning_side.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {sideText}
                    </span>
                  </div>
                );
              },
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
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) {
            setIsCreatingSystemWager(false);
          }
        }}
        onSubmit={handleCreateWager}
        submitting={submitting}
        categories={categories}
        isSystemWager={isCreatingSystemWager}
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
          categories={categories}
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
  categories,
  isSystemWager = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  submitting: boolean;
  wager?: Wager | null;
  categories: Array<{
    id: string;
    slug: string;
    label: string;
  }>;
  isSystemWager?: boolean;
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    minAmount: "",
    maxAmount: "",
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
        minAmount: (wager as any).min_amount?.toString() || wager.amount?.toString() || "",
        maxAmount: (wager as any).max_amount?.toString() || "",
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
        minAmount: "",
        maxAmount: "",
        sideA: "",
        sideB: "",
        deadline: "",
        category: "",
        currency: "NGN",
        isPublic: true,
        isSystemGenerated: false,
      });
    } else if (open && isSystemWager) {
      // Set system generated flag when opening modal for system wager
      setFormData(prev => ({
        ...prev,
        isSystemGenerated: true,
      }));
    }
  }, [wager, open, isSystemWager]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount || formData.minAmount || "0"),
      minAmount: parseFloat(formData.minAmount || formData.amount || "0"),
      maxAmount: formData.maxAmount ? parseFloat(formData.maxAmount) : null,
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
              <label className="block text-sm font-medium mb-2">Min Amount *</label>
              <input
                type="number"
                value={formData.minAmount}
                onChange={(e) => setFormData({ ...formData, minAmount: e.target.value, amount: e.target.value })}
                required
                min="1"
                step="0.01"
                placeholder="Minimum entry amount"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum amount users can join with</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Amount (Optional)</label>
              <input
                type="number"
                value={formData.maxAmount}
                onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                min={formData.minAmount || "1"}
                step="0.01"
                placeholder="Leave empty for unlimited"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum amount (leave empty for unlimited)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium mb-2">Legacy Amount (Auto-filled)</label>
              <input
                type="number"
                value={formData.amount}
                readOnly
                className="w-full px-4 py-2 border border-input rounded-lg bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">Auto-set to min amount for backward compatibility</p>
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
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
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

