"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { format } from "date-fns";
import { Plus, Loader2, BookOpen, Users, Clock, Trophy, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreateQuizModal } from "@/components/create-quiz-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";

interface Quiz {
  id: string;
  title: string;
  description?: string;
  entry_fee_per_question: number;
  max_participants: number;
  total_questions: number;
  base_cost?: number;
  platform_fee?: number;
  total_cost?: number;
  status: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
  participantCounts?: {
    total: number;
    completed: number;
  };
}

function QuizzesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams?.get('search') || '');

  const statusFilter = searchParams?.get('status') || 'all';

  useEffect(() => {
    fetchQuizzes();
  }, [statusFilter]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/quizzes?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch quizzes');
      }

      setQuizzes(data.data?.quizzes || []);
    } catch (error) {
      logger.error('Error fetching quizzes', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load quizzes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (searchQuery) {
      params.set('search', searchQuery);
    } else {
      params.delete('search');
    }
    router.push(`/quizzes?${params.toString()}`);
    fetchQuizzes();
  };

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(quiz => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'draft') return quiz.status === 'draft';
      if (statusFilter === 'open') return quiz.status === 'open';
      if (statusFilter === 'completed') return quiz.status === 'completed';
      if (statusFilter === 'settled') return quiz.status === 'settled';
      if (statusFilter === 'my-quizzes') return quiz.profiles?.username === user?.username;
      return true;
    });
  }, [quizzes, statusFilter, user]);

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700' },
      open: { label: 'Open', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700' },
      in_progress: { label: 'In Progress', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700' },
      completed: { label: 'Completed', className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700' },
      settled: { label: 'Settled', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700' },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700' },
    };
    const badge = badges[status as keyof typeof badges] || badges.draft;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1.5">Corporate Quizzes</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Create and participate in team building quizzes with monetary rewards
            </p>
          </div>
          {user && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Quiz
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1">
            <Input
              placeholder="Search quizzes by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 sm:h-11 text-sm sm:text-base"
            />
          </form>
          <div className="flex flex-wrap gap-2">
            {['all', 'draft', 'open', 'completed', 'settled', 'my-quizzes'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams(searchParams?.toString() || '');
                  if (status === 'all') {
                    params.delete('status');
                  } else {
                    params.set('status', status);
                  }
                  router.push(`/quizzes?${params.toString()}`);
                }}
                className="h-9 sm:h-10 text-xs sm:text-sm"
              >
                {status === 'my-quizzes' ? 'My Quizzes' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Quiz Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No quizzes found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try a different search term" : "Be the first to create a quiz!"}
              </p>
              {user && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quiz
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredQuizzes.map((quiz) => {
              // Use stored base_cost if available, otherwise calculate
              const baseCost = quiz.base_cost ?? (quiz.entry_fee_per_question * quiz.total_questions * quiz.max_participants);
              // Prize pool is base cost minus 10% platform fee
              const prizePool = baseCost;
              const participantCounts = quiz.participantCounts || { total: 0, completed: 0 };
              const participationProgress = quiz.max_participants > 0 
                ? (participantCounts.total / quiz.max_participants) * 100 
                : 0;

              return (
                <Link key={quiz.id} href={`/quiz/${quiz.id}`}>
                  <Card className="hover:shadow-lg dark:hover:shadow-xl transition-all cursor-pointer h-full border-border/50 hover:border-primary/50 group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <CardTitle className="line-clamp-2 text-base sm:text-lg group-hover:text-primary transition-colors flex-1">
                          {quiz.title}
                        </CardTitle>
                        {getStatusBadge(quiz.status)}
                      </div>
                      {quiz.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                          {quiz.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{quiz.total_questions} {quiz.total_questions === 1 ? 'question' : 'questions'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{participantCounts.total} / {quiz.max_participants}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{formatCurrency(quiz.entry_fee_per_question, DEFAULT_CURRENCY)}/q</span>
                        </div>
                        {quiz.end_date ? (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs truncate">{format(new Date(quiz.end_date), 'MMM d, h:mm a')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">No deadline</span>
                          </div>
                        )}
                      </div>

                      {participantCounts.total > 0 && (
                        <div className="pt-2 border-t border-border/50">
                          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                            <span className="text-muted-foreground">Participation</span>
                            <span className="font-semibold">
                              {participantCounts.completed} / {participantCounts.total} completed
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 sm:h-2">
                            <div 
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: `${Math.min(participationProgress, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="pt-2 sm:pt-3 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Total Prize Pool</p>
                        <p className="text-lg sm:text-xl font-bold text-primary">
                          {formatCurrency(prizePool, DEFAULT_CURRENCY)}
                        </p>
                        {quiz.base_cost && quiz.platform_fee && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(quiz.base_cost, DEFAULT_CURRENCY)} contributions • {formatCurrency(quiz.platform_fee, DEFAULT_CURRENCY)} fee
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {user && (
        <CreateQuizModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={() => {
            fetchQuizzes();
            window.dispatchEvent(new Event('quiz-created'));
          }}
        />
      )}
    </main>
  );
}

export default function QuizzesPage() {
  return (
    <Suspense fallback={
      <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 lg:py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    }>
      <QuizzesPageContent />
    </Suspense>
  );
}

