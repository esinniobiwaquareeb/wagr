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
  created_at: string;
  start_date?: string | null;
  end_date?: string | null;
  creator_id: string | null;
  profiles?: {
    username: string;
    avatar_url?: string;
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
      params.set('scope', 'admin');
      if (filterStatus !== 'all') {
        params.set('status', filterStatus);
      }

      const response = await fetch(`/api/quizzes?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch quizzes');
      }

      setQuizzes(data.data?.quizzes || []);
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
      cell: ({ row }: any) => (
        <div className="max-w-[300px]">
          <div className="font-medium truncate">{row.original.title}</div>
          {row.original.description && (
            <div className="text-sm text-muted-foreground truncate">{row.original.description}</div>
          )}
        </div>
      ),
    },
    {
      id: "creator",
      header: "Creator",
      cell: ({ row }: any) => (
        <div className="text-sm">
          {row.original.profiles?.username || 'Unknown'}
        </div>
      ),
    },
    {
      id: "total_questions",
      accessorKey: "total_questions",
      header: "Questions",
      cell: ({ row }: any) => (
        <div className="text-sm">{row.original.total_questions}</div>
      ),
    },
    {
      id: "max_participants",
      accessorKey: "max_participants",
      header: "Max Participants",
      cell: ({ row }: any) => (
        <div className="text-sm">{row.original.max_participants}</div>
      ),
    },
    {
      id: "entry_fee_per_question",
      accessorKey: "entry_fee_per_question",
      header: "Entry Fee",
      cell: ({ row }: any) => (
        <div className="text-sm">{formatCurrency(row.original.entry_fee_per_question, DEFAULT_CURRENCY)}</div>
      ),
    },
    {
      id: "total_cost",
      accessorKey: "total_cost",
      header: "Total Cost",
      cell: ({ row }: any) => (
        <div className="text-sm font-medium">{formatCurrency(row.original.total_cost, DEFAULT_CURRENCY)}</div>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => getStatusBadge(row.original.status),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }: any) => (
        <div className="text-sm text-muted-foreground">
          {format(new Date(row.original.created_at), "MMM d, yyyy")}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => {
        const quiz = row.original;
        return (
          <div className="flex items-center gap-2">
            <Link href={`/quiz/${quiz.id}`}>
              <Button variant="ghost" size="sm">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {quiz.status === 'draft' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(quiz)}
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

