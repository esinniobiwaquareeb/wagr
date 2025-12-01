"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { format } from "date-fns";
import { 
  Loader2, BookOpen, Users, Clock, Trophy, CheckCircle2, 
  ArrowLeft, Play, UserPlus, Settings, Award, Download, BarChart3, Check, Edit, Trash2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizTakingInterface } from "@/components/quiz-taking-interface";
import { QuizResults } from "@/components/quiz-results";
import { QuizInviteDialog } from "@/components/quiz-invite-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CreateQuizModal } from "@/components/create-quiz-modal";
import { QuizHeader } from "@/components/quiz-header";
import { QuizInfo } from "@/components/quiz-info";
import { QuizActions } from "@/components/quiz-actions";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";

interface Quiz {
  id: string;
  title: string;
  description?: string;
  entry_fee_per_question: number;
  max_participants: number;
  total_questions: number;
  status: string;
  start_date?: string;
  end_date?: string;
  duration_minutes?: number;
  randomize_questions: boolean;
  randomize_answers: boolean;
  show_results_immediately: boolean;
  settlement_method: string;
  top_winners_count?: number;
  base_cost?: number;
  platform_fee?: number;
  total_cost?: number;
  settled_at?: string;
  created_at: string;
  creator_id: string;
  profiles?: {
    username: string;
    avatar_url?: string;
    email?: string;
  };
  questions?: Array<{
    id: string;
    question_text: string;
    question_type: 'multiple_choice' | 'true_false';
    points: number;
    quiz_answers: Array<{
      id: string;
      answer_text: string;
      is_correct: boolean;
    }>;
  }>;
  participantCounts?: {
    total: number;
    completed: number;
  };
  participants?: Array<{
    id: string;
    user_id: string;
    status: string;
    score: number;
    percentage_score: number;
    rank: number | null;
    winnings: number;
    completed_at: string;
    profiles?: {
      username: string;
      avatar_url?: string;
      email?: string;
    };
  }>;
}

export default function QuizDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const quizId = params?.id as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [settling, setSettling] = useState(false);
  const [takingQuiz, setTakingQuiz] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [opening, setOpening] = useState(false);

  const isCreator = Boolean(user && quiz && quiz.creator_id === user.id);
  const countdown = useDeadlineCountdown(quiz?.end_date || null);
  const quizHasEnded = useMemo(() => {
    if (!quiz) return false;
    if (quiz.settled_at) return true;
    if (['completed', 'settled', 'cancelled'].includes(quiz.status)) return true;
    if (quiz.end_date) {
      return countdown.hasElapsed;
    }
    return false;
  }, [quiz, countdown.hasElapsed]);
  const canSettleQuiz = useMemo(() => {
    if (!quiz || !isCreator) return false;
    if (quiz.status === 'settled' || quiz.status === 'draft') return false;
    const completedCount = quiz.participantCounts?.completed ?? 0;
    return quizHasEnded && completedCount > 0;
  }, [quiz, isCreator, quizHasEnded]);

  useEffect(() => {
    if (quizId) {
      fetchQuiz();
    }
  }, [quizId, user]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quizzes/${quizId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch quiz');
      }

      const quizData = data.data?.quiz || null;
      setQuiz(quizData);

      // Check if user is a participant
      if (user && quizData?.participants) {
        const userParticipant = quizData.participants.find(
          (p: any) => p.user_id === user.id
        );
        setParticipant(userParticipant);

        const quizEndedServer = quizData?.end_date
          ? new Date(quizData.end_date).getTime() <= Date.now()
          : ['completed', 'settled', 'cancelled'].includes(quizData?.status);

        if (userParticipant && userParticipant.status === 'completed' && quizEndedServer) {
          fetchParticipantResponses();
        }
      }
    } catch (error) {
      console.error('Error fetching quiz:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load quiz",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = () => {
    setTakingQuiz(true);
  };

  const fetchParticipantResponses = async () => {
    if (!user || !quizId || !quizHasEnded) return;
    
    try {
      setLoadingResults(true);
      const response = await fetch(`/api/quizzes/${quizId}/responses`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch responses');
      }

      if (data.data) {
        setResponses(data.data.responses || []);
        setAllParticipants(data.data.participants || []);
        if (data.data.participant) {
          setParticipant(data.data.participant);
        }
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
      // Don't show error toast if results aren't available yet
      if (
        error instanceof Error && 
        !/not available/i.test(error.message) && 
        !/after the quiz ends/i.test(error.message)
      ) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoadingResults(false);
    }
  };

  const handleQuizComplete = async (quizResponses: any[]) => {
    // Store initial responses from submission
    if (quizResponses.length > 0) {
      setResponses(quizResponses);
    }
    setTakingQuiz(false);
    
    // Refresh quiz data to get updated participant status
    await fetchQuiz();
    
    if (quizHasEnded) {
      fetchParticipantResponses();
    }
  };

  const handleSettle = async () => {
    if (!quiz) return;

    setSettling(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}/settle`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to settle quiz');
      }

      toast({
        title: "Quiz settled!",
        description: "Winnings have been distributed to participants.",
      });

      setShowSettleDialog(false);
      fetchQuiz();
    } catch (error) {
      console.error('Error settling quiz:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to settle quiz",
        variant: "destructive",
      });
    } finally {
      setSettling(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!quiz || !user) return;

    setAccepting(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}/accept`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to accept invitation');
      }

      toast({
        title: "Invitation accepted!",
        description: "You can now participate in this quiz.",
      });

      // Dispatch event to notify invite dialog to refresh
      window.dispatchEvent(new Event('quiz-invite-accepted'));
      
      fetchQuiz(); // Refresh to get updated participant status
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to accept invitation",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!quiz) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete quiz');
      }

      toast({
        title: "Quiz deleted",
        description: "The quiz has been deleted successfully.",
      });

      router.push('/quizzes');
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete quiz",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleOpenQuiz = async () => {
    if (!quiz) return;

    setOpening(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to open quiz');
      }

      toast({
        title: "Quiz opened!",
        description: "Participants can now start taking the quiz.",
      });

      fetchQuiz(); // Refresh to get updated status
    } catch (error) {
      console.error('Error opening quiz:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to open quiz",
        variant: "destructive",
      });
    } finally {
      setOpening(false);
    }
  };

  const handleExportResults = async () => {
    if (!quiz) return;

    setExporting(true);
    try {
      // Get all participants with completed status
      const participantsToExport = allParticipants.length > 0 
        ? allParticipants 
        : (quiz.participants || []).filter((p: any) => p.status === 'completed');
      
      if (participantsToExport.length === 0) {
        toast({
          title: "No data to export",
          description: "No completed participants found.",
          variant: "destructive",
        });
        return;
      }

      // Calculate total possible points
      const totalPossiblePoints = quiz.questions?.reduce((sum: number, q: any) => sum + (q.points || 1), 0) || quiz.total_questions || 1;

      // Prepare CSV data
      const headers = ['Rank', 'Username', 'Email', 'Score', 'Percentage', 'Winnings', 'Completed At'];
      const rows = participantsToExport
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime();
        })
        .map((p: any, index: number) => {
          const percentage = p.percentage_score != null 
            ? p.percentage_score 
            : totalPossiblePoints > 0 
              ? ((p.score || 0) / totalPossiblePoints) * 100 
              : 0;
          
          return [
            p.rank || index + 1,
            p.profiles?.username || 'Unknown',
            p.profiles?.email || '',
            p.score || 0,
            `${percentage.toFixed(2)}%`,
            formatCurrency(p.winnings || 0, DEFAULT_CURRENCY),
            p.completed_at ? format(new Date(p.completed_at), 'PPp') : '',
          ];
        });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `quiz-${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-results-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: "Quiz results have been exported to CSV.",
      });
    } catch (error) {
      console.error('Error exporting results:', error);
      toast({
        title: "Error",
        description: "Failed to export quiz results",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const isCreatorLegacy = user && quiz && quiz.creator_id === user.id;
  const isCreatorFlag = isCreator || Boolean(isCreatorLegacy); // maintain existing truthy usage
  const canTakeQuiz = Boolean(
    user &&
    quiz &&
    ['open', 'in_progress'].includes(quiz.status) &&
    participant &&
    ['invited', 'accepted'].includes(participant.status)
  );
  const hasCompleted = participant && participant.status === 'completed';
  const waitingForResults = Boolean(hasCompleted && !quizHasEnded);
  const showResults = Boolean(hasCompleted && quizHasEnded);

  useEffect(() => {
    if (hasCompleted && quizHasEnded) {
      fetchParticipantResponses();
    }
  }, [hasCompleted, quizHasEnded]);

  if (loading) {
    return (
      <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 lg:py-8">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-full mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 lg:py-8">
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-muted-foreground">Quiz not found</p>
              <Button asChild className="mt-4">
                <Link href="/quizzes">Back to Quizzes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }


  return (
    <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 lg:py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/quizzes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quizzes
          </Link>
        </Button>

        {/* Quiz Taking Interface */}
        {takingQuiz && (
          <QuizTakingInterface
            quizId={quizId}
            quizTitle={quiz.title}
            durationMinutes={quiz.duration_minutes || undefined}
            onComplete={handleQuizComplete}
          />
        )}

        {/* Quiz Details */}
        {!takingQuiz && (
          <>
            <Card className="mb-6">
            <QuizHeader
                title={quiz.title}
                description={quiz.description}
                isCreator={isCreatorFlag}
                status={quiz.status}
                onInvite={() => setShowInviteDialog(true)}
                onSettle={() => setShowSettleDialog(true)}
                canSettle={canSettleQuiz}
                onExport={handleExportResults}
                onEdit={() => setShowEditModal(true)}
                onDelete={() => setShowDeleteDialog(true)}
                onOpen={handleOpenQuiz}
                opening={opening}
                exporting={exporting}
                participants={quiz.participants}
              />
              <QuizInfo
                totalQuestions={quiz.total_questions}
                entryFeePerQuestion={quiz.entry_fee_per_question}
                maxParticipants={quiz.max_participants}
                baseCost={quiz.base_cost}
                platformFee={quiz.platform_fee}
                totalCost={quiz.total_cost}
                participantCounts={quiz.participantCounts}
                startDate={quiz.start_date}
                endDate={quiz.end_date}
                durationMinutes={quiz.duration_minutes}
                status={quiz.status}
                countdown={quiz.end_date ? countdown : undefined}
              />
              <QuizActions
                user={user}
                participant={participant}
                quizStatus={quiz.status}
                onAcceptInvite={handleAcceptInvite}
                onStartQuiz={handleStartQuiz}
                accepting={accepting}
              />
            </Card>

            {waitingForResults && (
              <Card className="mt-6 border-dashed">
                <CardContent className="pt-6 flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400">
                    <AlertCircle className="h-5 w-5" />
                    <div>
                      <p className="font-semibold">Hold tight!</p>
                      <p className="text-sm text-muted-foreground">
                        Answer summaries unlock when the quiz ends to keep things fair for everyone.
                      </p>
                    </div>
                  </div>
                  {quiz?.end_date && !countdown.hasElapsed && (
                    <div className="text-sm text-muted-foreground">
                      Ends in: <span className="font-medium">{countdown.countdown.replace(/^00:/, '')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quiz Results/History - Show after completion and quiz end */}
            {showResults && participant && (
              <div className="mt-6">
                {loadingResults ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading results...</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <QuizResults
                    quiz={{
                      id: quiz.id,
                      title: quiz.title,
                      total_questions: quiz.total_questions,
                      entry_fee_per_question: quiz.entry_fee_per_question,
                      status: quiz.status,
                      settled_at: quiz.settled_at,
                    }}
                    participant={participant}
                    participants={allParticipants.length > 0 ? allParticipants : (quiz.participants || []).filter((p: any) => p.status === 'completed')}
                    responses={responses}
                    showDetails={true}
                  />
                )}
              </div>
            )}

            {/* Show scoreboard for all participants if quiz is settled or completed (for creator) */}
            {isCreator && (quiz.status === 'settled' || quiz.status === 'completed') && quiz.participants && quiz.participants.length > 0 && (
              <div className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Scoreboard - All Participants
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <QuizResults
                      quiz={{
                        id: quiz.id,
                        title: quiz.title,
                        total_questions: quiz.total_questions,
                        entry_fee_per_question: quiz.entry_fee_per_question,
                        status: quiz.status,
                        settled_at: quiz.settled_at,
                      }}
                      participant={undefined}
                      participants={(quiz.participants || []).filter((p: any) => p.status === 'completed')}
                      responses={[]}
                      showDetails={false}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Dialog */}
      {isCreator && (
        <QuizInviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          quizId={quizId}
          quizTitle={quiz.title}
        />
      )}

      {/* Settle Dialog */}
      <ConfirmDialog
        open={showSettleDialog}
        onOpenChange={(open) => {
          if (!settling) {
            setShowSettleDialog(open);
          }
        }}
        title="Settle Quiz"
        description="Are you sure you want to settle this quiz? Winnings will be distributed to participants based on their scores."
        confirmText={settling ? "Settling..." : "Settle"}
        onConfirm={handleSettle}
        variant="default"
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!deleting) {
            setShowDeleteDialog(open);
          }
        }}
        title="Delete Quiz"
        description={`Are you sure you want to delete "${quiz?.title}"? This action cannot be undone. All funds will be refunded if no participants have started.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        onConfirm={handleDeleteQuiz}
        variant="destructive"
      />

      {/* Edit Modal */}
      {quiz && isCreator && (
        <CreateQuizModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          quizId={quiz.id}
          initialData={{
            title: quiz.title,
            description: quiz.description || undefined,
            entryFeePerQuestion: quiz.entry_fee_per_question,
            maxParticipants: quiz.max_participants,
            totalQuestions: quiz.total_questions,
            startDate: quiz.start_date || undefined,
            endDate: quiz.end_date || undefined,
            durationMinutes: quiz.duration_minutes || undefined,
            randomizeQuestions: quiz.randomize_questions,
            randomizeAnswers: quiz.randomize_answers,
            showResultsImmediately: quiz.show_results_immediately,
            settlementMethod: quiz.settlement_method as 'proportional' | 'top_winners' | 'equal_split',
            topWinnersCount: quiz.top_winners_count || undefined,
            questions: quiz.questions?.map(q => ({
              questionText: q.question_text,
              questionType: q.question_type as 'multiple_choice' | 'true_false',
              points: q.points || 1,
              answers: q.quiz_answers.map(a => ({
                answerText: a.answer_text,
                isCorrect: a.is_correct,
              })),
            })),
          }}
          onSuccess={() => {
            fetchQuiz();
            setShowEditModal(false);
          }}
        />
      )}
    </main>
  );
}

