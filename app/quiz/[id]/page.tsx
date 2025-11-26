"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { format } from "date-fns";
import { 
  Loader2, BookOpen, Users, Clock, Trophy, CheckCircle2, 
  ArrowLeft, Play, UserPlus, Settings, Award, Download, BarChart3
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizTakingInterface } from "@/components/quiz-taking-interface";
import { QuizResults } from "@/components/quiz-results";
import { QuizInviteDialog } from "@/components/quiz-invite-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [settling, setSettling] = useState(false);
  const [takingQuiz, setTakingQuiz] = useState(false);
  const [exporting, setExporting] = useState(false);

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

      setQuiz(data.data?.quiz || null);

      // Check if user is a participant
      if (user && data.data?.quiz?.participants) {
        const userParticipant = data.data.quiz.participants.find(
          (p: any) => p.user_id === user.id
        );
        setParticipant(userParticipant);

        // If participant has completed, fetch their responses
        if (userParticipant && userParticipant.status === 'completed') {
          fetchParticipantResponses(userParticipant.id);
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

  const fetchParticipantResponses = async (participantId: string) => {
    try {
      // Get responses for this participant
      const response = await fetch(`/api/quizzes/${quizId}`);
      const data = await response.json();
      
      if (data.data?.quiz?.participants) {
        const userParticipant = data.data.quiz.participants.find(
          (p: any) => p.user_id === user?.id
        );
        if (userParticipant) {
          // Responses would be fetched from the quiz detail endpoint
          // For now, we'll get them from the take endpoint response
        }
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const handleQuizComplete = (quizResponses: any[]) => {
    setResponses(quizResponses);
    setTakingQuiz(false);
    fetchQuiz(); // Refresh to get updated participant data
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

  const handleExportResults = async () => {
    if (!quiz || !quiz.participants) return;

    setExporting(true);
    try {
      // Prepare CSV data
      const headers = ['Rank', 'Username', 'Email', 'Score', 'Percentage', 'Winnings', 'Completed At'];
      const rows = (quiz.participants || [])
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
        })
        .map((p, index) => [
          p.rank || index + 1,
          p.profiles?.username || 'Unknown',
          p.profiles?.email || '',
          p.score,
          `${p.percentage_score.toFixed(2)}%`,
          formatCurrency(p.winnings, DEFAULT_CURRENCY),
          p.completed_at ? format(new Date(p.completed_at), 'PPp') : '',
        ]);

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

  const isCreator = user && quiz && quiz.creator_id === user.id;
  const canTakeQuiz = user && 
    quiz && 
    ['open', 'in_progress'].includes(quiz.status) &&
    participant &&
    ['invited', 'accepted'].includes(participant.status);
  const hasCompleted = participant && participant.status === 'completed';
  const showResults = hasCompleted && (quiz?.show_results_immediately || quiz?.status === 'settled');

  if (loading) {
    return (
      <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 lg:py-8">
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
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 lg:py-8">
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

  const totalCost = quiz.entry_fee_per_question * quiz.total_questions * quiz.max_participants;
  const prizePool = totalCost * 0.9; // 10% platform fee

  return (
    <main className="flex-1 pb-24 lg:pb-0 w-full overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 lg:py-8">
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
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">{quiz.title}</CardTitle>
                    {quiz.description && (
                      <p className="text-muted-foreground">{quiz.description}</p>
                    )}
                  </div>
                  {isCreator && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowInviteDialog(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite
                      </Button>
                      {quiz.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSettleDialog(true)}
                        >
                          <Award className="h-4 w-4 mr-2" />
                          Settle
                        </Button>
                      )}
                      {quiz.status === 'settled' && quiz.participants && quiz.participants.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportResults}
                          disabled={exporting}
                        >
                          {exporting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Export
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Questions</p>
                    <p className="text-lg font-semibold">{quiz.total_questions}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Entry Fee</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(quiz.entry_fee_per_question, DEFAULT_CURRENCY)} per question
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Participants</p>
                    <p className="text-lg font-semibold">
                      {quiz.participantCounts?.total || 0} / {quiz.max_participants}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prize Pool</p>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(prizePool, DEFAULT_CURRENCY)}
                    </p>
                  </div>
                </div>

                {quiz.end_date && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>Ends: {format(new Date(quiz.end_date), 'PPp')}</span>
                    </div>
                  </div>
                )}

                {canTakeQuiz && (
                  <div className="pt-4 border-t">
                    <Button onClick={handleStartQuiz} className="w-full" size="lg">
                      <Play className="h-4 w-4 mr-2" />
                      Start Quiz
                    </Button>
                  </div>
                )}

                {!participant && user && quiz.status === 'open' && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      You need to be invited to participate in this quiz.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results */}
            {showResults && participant && (
              <QuizResults
                quiz={quiz}
                participant={participant}
                participants={quiz.participants || []}
                responses={responses}
                showDetails={true}
              />
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
    </main>
  );
}

