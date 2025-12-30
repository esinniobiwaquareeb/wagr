"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { format } from "date-fns";
import { Eye, Award, Trash2, Loader2, BookOpen, Users, Trophy, Calendar, DollarSign, CheckCircle } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAdmin } from "@/contexts/admin-context";
import { apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

interface Quiz {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  entry_fee_per_question: number;
  max_participants: number;
  total_questions: number;
  total_cost: number;
  base_cost?: number;
  platform_fee?: number;
  created_at: string | null;
  start_date?: string | null;
  end_date?: string | null;
  creator_id: string | null;
  creator?: {
    id: string;
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
  participantCounts?: {
    total: number;
    completed: number;
  };
}

export default function AdminQuizzesPage() {
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "open" | "completed" | "settled">("all");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState<Quiz | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchQuizzes = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('page', '1');
      if (filterStatus !== 'all') {
        params.set('status', filterStatus);
      }

      const response = await fetch(`/api/admin/quizzes?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch quizzes');
      }

      // API returns: { success: true, data: { quizzes: [...], pagination: {...} } }
      const quizzesData = result.data?.quizzes || result.quizzes || [];
      setQuizzes(quizzesData);
    } catch (error) {
      logger.error("Error fetching quizzes", error);
      toast({
        title: "Error",
        description: "Failed to fetch quizzes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filterStatus, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchQuizzes();
    }
  }, [isAdmin, fetchQuizzes]);

  const handleDeleteClick = (quiz: Quiz) => {
    setDeletingQuiz(quiz);
    setShowDeleteDialog(true);
  };

  const handleDeleteQuiz = async () => {
    if (!isAdmin || !deletingQuiz) return;

    setDeleting(true);
    try {
      await apiDelete(`/api/quizzes/${deletingQuiz.id}`);
      
      toast({
        title: "Quiz deleted",
        description: "The quiz has been deleted successfully.",
      });

      setShowDeleteDialog(false);
      setDeletingQuiz(null);
      fetchQuizzes();
    } catch (error) {
      logger.error("Error deleting quiz", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete quiz.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
      open: { label: 'Open', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      completed: { label: 'Completed', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      settled: { label: 'Settled', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    };
    const badge = badges[status as keyof typeof badges] || badges.draft;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const columns: any[] = [
    {
      id: "title",
      accessorKey: "title",
      header: "Title",
      cell: (row: Quiz) => {
        return (
          <div className="max-w-[300px]">
            <Link
              href={`/admin/quizzes/${row.id}`}
              className="font-medium truncate hover:text-primary transition line-clamp-1"
            >
              {row.title || "Untitled Quiz"}
            </Link>
            {row.description && (
              <div className="text-sm text-muted-foreground truncate">{row.description}</div>
            )}
          </div>
        );
      },
    },
    {
      id: "creator",
      header: "Creator",
      cell: (row: Quiz) => {
        const name = row.creator?.username || row.creator?.email || 'Unknown';
        return (
          <div className="text-sm">
            <p className="font-medium">{name}</p>
            {row.creator?.email && row.creator?.username && (
              <p className="text-xs text-muted-foreground truncate">{row.creator.email}</p>
            )}
          </div>
        );
      },
    },
    {
      id: "total_questions",
      accessorKey: "total_questions",
      header: "Questions",
      cell: (row: Quiz) => {
        return <div className="text-sm">{row.total_questions || 0}</div>;
      },
    },
    {
      id: "max_participants",
      accessorKey: "max_participants",
      header: "Max Participants",
      cell: (row: Quiz) => {
        const counts = row.participantCounts;
        return (
          <div className="text-sm">
            {row.max_participants || 0}
            {counts ? (
              <span className="text-xs text-muted-foreground ml-1">
                ({counts.completed}/{counts.total} completed)
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "entry_fee_per_question",
      accessorKey: "entry_fee_per_question",
      header: "Entry Fee",
      cell: (row: Quiz) => {
        const entryFee = Number(row.entry_fee_per_question) || 0;
        return (
          <div className="text-sm font-medium">
            {formatCurrency(entryFee, DEFAULT_CURRENCY)}
          </div>
        );
      },
    },
    {
      id: "total_cost",
      accessorKey: "total_cost",
      header: "Total Cost",
      cell: (row: Quiz) => {
        const total = Number(row.total_cost) || 0;
        const base = Number(row.base_cost) || 0;
        const fee = Number(row.platform_fee) || 0;
        return (
          <div className="text-sm font-medium">
            {formatCurrency(total, DEFAULT_CURRENCY)}
            <div className="text-xs text-muted-foreground">
              Base {formatCurrency(base, DEFAULT_CURRENCY)} • Fee {formatCurrency(fee, DEFAULT_CURRENCY)}
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: (row: Quiz) => {
        return getStatusBadge(row.status);
      },
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: "Created",
      cell: (row: Quiz) => {
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        const displayDate =
          createdAt && !Number.isNaN(createdAt.getTime()) ? format(createdAt, "MMM d, yyyy") : "—";
        return <div className="text-sm text-muted-foreground">{displayDate}</div>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row: Quiz) => {
        return (
          <div className="flex items-center gap-2">
            <Link href={`/admin/quizzes/${row.id}`}>
              <Button variant="ghost" size="sm" title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {row.status === 'draft' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(row)}
                title="Delete Quiz"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const filteredQuizzes = useMemo(() => {
    if (filterStatus === 'all') return quizzes;
    return quizzes.filter(q => q.status === filterStatus);
  }, [quizzes, filterStatus]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = quizzes.length;
    const draft = quizzes.filter(q => q.status === 'draft').length;
    const open = quizzes.filter(q => q.status === 'open').length;
    const completed = quizzes.filter(q => q.status === 'completed' || q.status === 'settled').length;
    const totalValue = quizzes.reduce((sum, q) => sum + (Number(q.total_cost) || 0), 0);
    return { total, draft, open, completed, totalValue };
  }, [quizzes]);

  if (!isAdmin || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage all corporate quizzes on the platform
          </p>
        </div>

        {/* Stats - Compact */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Total</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <BookOpen className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold">{stats.total.toLocaleString()}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Draft</h3>
              <div className="h-6 w-6 rounded-md bg-gray-500/10 flex items-center justify-center group-hover:bg-gray-500/20 transition-colors">
                <Calendar className="h-3 w-3 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            <div className="text-base font-bold text-gray-600 dark:text-gray-400">{stats.draft.toLocaleString()}</div>
          </div>
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Open</h3>
              <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400">{stats.open.toLocaleString()}</div>
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
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Total Value</h3>
              <div className="h-6 w-6 rounded-md bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <DollarSign className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-base font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stats.totalValue, DEFAULT_CURRENCY)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'draft', 'open', 'completed', 'settled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Quizzes Table */}
        <Card className="border border-border/80">
          <CardHeader>
            <CardTitle>All Quizzes</CardTitle>
            <CardDescription>View and manage quiz records</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={filteredQuizzes}
              searchKeys={['title', 'description']}
              searchPlaceholder="Search quizzes..."
              pagination
              pageSize={20}
              sortable
              defaultSort={{ key: "created_at", direction: "desc" }}
              emptyMessage="No quizzes found"
            />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!deleting) {
            setShowDeleteDialog(open);
          }
        }}
        title="Delete Quiz"
        description={`Are you sure you want to delete "${deletingQuiz?.title}"? This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        variant="destructive"
        onConfirm={handleDeleteQuiz}
      />
    </main>
  );
}

