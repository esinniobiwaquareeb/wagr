"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { format } from "date-fns";
import { Eye, Award, Trash2, Loader2, BookOpen, Users, Trophy, Calendar } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { getCurrentUser } from "@/lib/auth/client";
import { apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

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
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "open" | "completed" | "settled">("all");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState<Quiz | null>(null);
  const [deleting, setDeleting] = useState(false);

  const checkAdmin = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser(true);
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

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

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
      console.error("Error fetching quizzes:", error);
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
      console.error("Error deleting quiz:", error);
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

  if (!isAdmin || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Quiz Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage all corporate quizzes on the platform
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'draft', 'open', 'completed', 'settled'] as const).map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus(status)}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredQuizzes}
        searchKeys={['title', 'description']}
        searchPlaceholder="Search quizzes..."
      />

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
    </div>
  );
}

