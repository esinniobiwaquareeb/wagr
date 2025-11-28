"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Clock, CheckCircle2, Users, AlertTriangle, ExternalLink, BookOpen, Trophy, DollarSign, Calendar, Award } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/auth/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminQuizDetailPageProps {
  params: Promise<{ id: string }>;
}

interface QuizParticipant {
  id: string;
  user_id: string;
  status: string;
  score: number;
  percentage_score: number;
  rank: number | null;
  winnings: number;
  completed_at: string | null;
  started_at: string | null;
  _searchUsername?: string;
  _searchEmail?: string;
  user?: {
    id: string;
    username: string | null;
    email: string | null;
    avatar_url?: string | null;
  } | null;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: string;
  points: number;
  order_index: number;
  quiz_answers: Array<{
    id: string;
    answer_text: string;
    is_correct: boolean;
    order_index: number;
  }>;
}

export default function AdminQuizDetailPage({ params }: AdminQuizDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [participants, setParticipants] = useState<QuizParticipant[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [totalPrizePool, setTotalPrizePool] = useState(0);
  const [totalDistributed, setTotalDistributed] = useState(0);

  const loadDetails = useCallback(
    async (quizId: string) => {
      if (!isAdmin) return;

      setLoading(true);
      try {
        // Fetch quiz with creator info
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select(
            `
            *,
            creator:profiles!quizzes_creator_id_fkey(
              id,
              username,
              email,
              avatar_url
            )
          `
          )
          .eq("id", quizId)
          .single();

        if (quizError || !quizData) {
          throw quizError || new Error("Quiz not found");
        }

        setQuiz(quizData);

        // Fetch participants
        const { data: participantData, error: participantError } = await supabase
          .from("quiz_participants")
          .select(
            `
            *,
            user:profiles!quiz_participants_user_id_fkey(
              id,
              username,
              email,
              avatar_url
            )
          `
          )
          .eq("quiz_id", quizId)
          .order("score", { ascending: false })
          .order("completed_at", { ascending: true });

        if (participantError) {
          throw participantError;
        }

        const participantsWithFallback = (participantData || []).map((p: any) => ({
          ...p,
          user: Array.isArray(p.user) ? p.user[0] || null : p.user || null,
        }));

        // Calculate ranks
        const rankedParticipants = participantsWithFallback.map((p, index) => ({
          ...p,
          rank: p.status === "completed" ? index + 1 : null,
          _searchUsername: p.user?.username || '',
          _searchEmail: p.user?.email || '',
        }));

        setParticipants(rankedParticipants);

        // Calculate totals
        const completed = rankedParticipants.filter((p) => p.status === "completed");
        const totalPool = Number(quizData.base_cost || 0);
        const totalWinnings = completed.reduce((sum, p) => sum + Number(p.winnings || 0), 0);
        setTotalPrizePool(totalPool);
        setTotalDistributed(totalWinnings);

        // Fetch questions
        const { data: questionData, error: questionError } = await supabase
          .from("quiz_questions")
          .select(
            `
            *,
            quiz_answers (
              id,
              answer_text,
              is_correct,
              order_index
            )
          `
          )
          .eq("quiz_id", quizId)
          .order("order_index", { ascending: true });

        if (questionError) {
          console.error("Error fetching questions:", questionError);
        } else {
          setQuestions(questionData || []);
        }
      } catch (error) {
        console.error("Failed to load quiz", error);
        toast({
          title: "Unable to load quiz",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, supabase, toast],
  );

  useEffect(() => {
    (async () => {
      const { id } = await params;
      try {
        const currentUser = await getCurrentUser(true);
        if (!currentUser || !currentUser.is_admin) {
          router.replace("/admin/login");
          return;
        }
        setIsAdmin(true);
        loadDetails(id);
      } catch (error) {
        router.replace("/admin/login");
      }
    })();
  }, [params, router, loadDetails]);

  if (!isAdmin) {
    return null;
  }

  if (loading || !quiz) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </main>
    );
  }

  const currency = (quiz.currency || DEFAULT_CURRENCY) as Currency;
  const baseCost = Number(quiz.base_cost || 0);
  const platformFee = Number(quiz.platform_fee || 0);
  const totalCost = Number(quiz.total_cost || 0);
  const entryFee = Number(quiz.entry_fee_per_question || 0);

  const statusBadge = (() => {
    switch (quiz.status) {
      case "draft":
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-700 dark:text-gray-400">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "open":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Open
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "settled":
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
            <Trophy className="h-3 w-3 mr-1" />
            Settled
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{quiz.status}</Badge>;
    }
  })();

  const participantColumns = [
    {
      id: "rank",
      header: "Rank",
      cell: (row: QuizParticipant) => (
        <div className="flex items-center gap-2">
          {row.rank ? (
            <>
              <Trophy className={`h-4 w-4 ${row.rank === 1 ? 'text-yellow-500' : row.rank === 2 ? 'text-gray-400' : row.rank === 3 ? 'text-orange-600' : 'text-muted-foreground'}`} />
              <span className="font-semibold">#{row.rank}</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      id: "participant",
      header: "Participant",
      cell: (row: QuizParticipant) => (
        <div className="flex flex-col text-sm">
          <span className="font-medium">{row.user?.username ? `@${row.user.username}` : row.user_id.substring(0, 8)}</span>
          {row.user?.email && <span className="text-xs text-muted-foreground">{row.user.email}</span>}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: QuizParticipant) => (
        <Badge variant="outline" className="text-xs">
          {row.status}
        </Badge>
      ),
    },
    {
      id: "score",
      header: "Score",
      cell: (row: QuizParticipant) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.score || 0} / {quiz.total_questions * (entryFee || 0)}</span>
          <span className="text-xs text-muted-foreground">{row.percentage_score?.toFixed(1) || 0}%</span>
        </div>
      ),
    },
    {
      id: "winnings",
      header: "Winnings",
      cell: (row: QuizParticipant) => (
        <span className="font-semibold text-green-600 dark:text-green-400">
          {formatCurrency(Number(row.winnings || 0), currency)}
        </span>
      ),
    },
    {
      id: "completed",
      header: "Completed",
      cell: (row: QuizParticipant) => (
        <span className="text-xs text-muted-foreground">
          {row.completed_at ? format(new Date(row.completed_at), "MMM d, yyyy HH:mm") : "—"}
        </span>
      ),
    },
  ];

  const questionColumns = [
    {
      id: "order",
      header: "#",
      cell: (row: QuizQuestion) => <span className="font-medium">{row.order_index + 1}</span>,
    },
    {
      id: "question",
      header: "Question",
      cell: (row: QuizQuestion) => (
        <div className="max-w-md">
          <p className="font-medium text-sm">{row.question_text}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {row.question_type === "multiple_choice" ? "Multiple Choice" : "True/False"} • {row.points} points
          </p>
        </div>
      ),
    },
    {
      id: "answers",
      header: "Answers",
      cell: (row: QuizQuestion) => (
        <div className="space-y-1">
          {row.quiz_answers
            .sort((a, b) => a.order_index - b.order_index)
            .map((answer) => (
              <div
                key={answer.id}
                className={`text-xs p-1 rounded ${
                  answer.is_correct
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 font-medium"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {answer.is_correct && "✓ "}
                {answer.answer_text}
              </div>
            ))}
        </div>
      ),
    },
  ];

  const completedCount = participants.filter((p) => p.status === "completed").length;
  const invitedCount = participants.filter((p) => p.status === "invited").length;
  const acceptedCount = participants.filter((p) => p.status === "accepted").length;
  const startedCount = participants.filter((p) => p.status === "started").length;

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-2xl font-bold">{quiz.title}</h1>
            {statusBadge}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/quiz/${quiz.id}`}
              className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-md border hover:bg-muted transition"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View user page
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(totalCost, currency)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Base: {formatCurrency(baseCost, currency)} • Fee: {formatCurrency(platformFee, currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Participants</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xl font-semibold">{participants.length} / {quiz.max_participants}</p>
                <p className="text-xs text-muted-foreground">
                  {completedCount} completed • {startedCount} started
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Prize Pool</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(totalPrizePool, currency)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(totalDistributed, currency)} distributed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Questions</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xl font-semibold">{quiz.total_questions}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(entryFee, currency)} per question</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Creator:</span>{" "}
                {quiz.creator?.username ? `@${quiz.creator.username}` : quiz.creator_id || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Created:</span>{" "}
                {quiz.created_at ? format(new Date(quiz.created_at), "MMM d, yyyy HH:mm") : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Start Date:</span>{" "}
                {quiz.start_date ? format(new Date(quiz.start_date), "MMM d, yyyy HH:mm") : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">End Date:</span>{" "}
                {quiz.end_date ? format(new Date(quiz.end_date), "MMM d, yyyy HH:mm") : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Duration:</span>{" "}
                {quiz.duration_minutes ? `${quiz.duration_minutes} minutes` : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Settlement Method:</span>{" "}
                {quiz.settlement_method || "—"}
              </p>
              {quiz.settled_at && (
                <p>
                  <span className="text-muted-foreground">Settled At:</span>{" "}
                  {format(new Date(quiz.settled_at), "MMM d, yyyy HH:mm")}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Randomize Questions:</span>{" "}
                {quiz.randomize_questions ? "Yes" : "No"}
              </p>
              <p>
                <span className="text-muted-foreground">Randomize Answers:</span>{" "}
                {quiz.randomize_answers ? "Yes" : "No"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {quiz.description || "No description provided."}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="participants" className="space-y-4">
          <TabsList>
            <TabsTrigger value="participants">
              <Users className="h-4 w-4 mr-2" />
              Participants ({participants.length})
            </TabsTrigger>
            <TabsTrigger value="questions">
              <BookOpen className="h-4 w-4 mr-2" />
              Questions ({questions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participants">
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <CardTitle>Participants</CardTitle>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>Invited: {invitedCount}</span>
                  <span>•</span>
                  <span>Accepted: {acceptedCount}</span>
                  <span>•</span>
                  <span>Started: {startedCount}</span>
                  <span>•</span>
                  <span>Completed: {completedCount}</span>
                </div>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No participants yet.</p>
                ) : (
                  <DataTable
                    data={participants}
                    columns={participantColumns as any}
                    searchable
                    searchPlaceholder="Search by username or email..."
                    searchKeys={["_searchUsername", "_searchEmail"]}
                    pageSize={10}
                    pagination
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle>Questions & Answers</CardTitle>
              </CardHeader>
              <CardContent>
                {questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No questions found.</p>
                ) : (
                  <DataTable
                    data={questions}
                    columns={questionColumns as any}
                    searchable={false}
                    pageSize={10}
                    pagination
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

