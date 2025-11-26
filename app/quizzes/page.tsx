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
      console.error('Error fetching quizzes:', error);
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
      if (statusFilter === 'open') return quiz.status === 'open';
      if (statusFilter === 'completed') return quiz.status === 'completed';
      if (statusFilter === 'settled') return quiz.status === 'settled';
      if (statusFilter === 'my-quizzes') return quiz.profiles?.username === user?.username;
      return true;
    });
  }, [quizzes, statusFilter, user]);

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      open: { label: 'Open', className: 'bg-blue-100 text-blue-800' },
      in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Completed', className: 'bg-purple-100 text-purple-800' },
      settled: { label: 'Settled', className: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
    };
    const badge = badges[status as keyof typeof badges] || badges.draft;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Corporate Quizzes</h1>
            <p className="text-sm text-muted-foreground">
              Create and participate in team building quizzes with monetary rewards
            </p>
          </div>
          {user && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Quiz
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1">
            <Input
              placeholder="Search quizzes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
          <div className="flex gap-2">
            {['all', 'open', 'completed', 'settled', 'my-quizzes'].map((status) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuizzes.map((quiz) => {
              // Use stored base_cost if available, otherwise calculate
              const baseCost = quiz.base_cost ?? (quiz.entry_fee_per_question * quiz.total_questions * quiz.max_participants);
              // Prize pool is base cost minus 10% platform fee
              const prizePool = baseCost;
              const participantCounts = quiz.participantCounts || { total: 0, completed: 0 };

              return (
                <Link key={quiz.id} href={`/quiz/${quiz.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="line-clamp-2">{quiz.title}</CardTitle>
                        {getStatusBadge(quiz.status)}
                      </div>
                      {quiz.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {quiz.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span>{quiz.total_questions} questions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{participantCounts.total} / {quiz.max_participants} participants</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-muted-foreground" />
                          <span>{formatCurrency(quiz.entry_fee_per_question, DEFAULT_CURRENCY)} per question</span>
                        </div>
                        {quiz.start_date && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">Starts: {format(new Date(quiz.start_date), 'MMM d, h:mm a')}</span>
                          </div>
                        )}
                        {quiz.end_date && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">Ends: {format(new Date(quiz.end_date), 'MMM d, h:mm a')}</span>
                          </div>
                        )}
                        {!quiz.start_date && !quiz.end_date && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">No time limit</span>
                          </div>
                        )}
                      </div>

                      {participantCounts.completed > 0 && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Completed</span>
                            <span className="font-medium">
                              {participantCounts.completed} / {participantCounts.total}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Total Prize Pool</p>
                        <p className="text-lg font-bold">
                          {formatCurrency(prizePool, DEFAULT_CURRENCY)}
                        </p>
                        {quiz.base_cost && quiz.platform_fee && (
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(quiz.base_cost, DEFAULT_CURRENCY)} contributions - {formatCurrency(quiz.platform_fee, DEFAULT_CURRENCY)} platform fee
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

