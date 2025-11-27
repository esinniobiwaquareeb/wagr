"use client";

import { useMemo } from "react";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { Trophy, Medal, Award, Users, CheckCircle2, XCircle, FileText, BarChart3, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";

interface Participant {
  id: string;
  user_id: string;
  score: number;
  percentage_score?: number | null;
  rank: number | null;
  winnings: number;
  completed_at: string;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

interface QuizResultsProps {
  quiz: {
    id: string;
    title: string;
    total_questions: number;
    entry_fee_per_question: number;
    status: string;
    settled_at?: string;
    questions?: Array<{
      id: string;
      points?: number;
    }>;
  };
  participant?: Participant;
  participants?: Participant[];
  responses?: Array<{
    question_id: string;
    answer_id: string;
    is_correct: boolean;
    points_earned: number;
    quiz_questions?: {
      question_text: string;
      points: number;
      quiz_answers?: Array<{
        id: string;
        answer_text: string;
        is_correct: boolean;
      }>;
    };
  }>;
  showDetails?: boolean;
}

export function QuizResults({
  quiz,
  participant,
  participants = [],
  responses = [],
  showDetails = false,
}: QuizResultsProps) {
  const isSettled = quiz.status === 'settled';
  const totalPossiblePoints = useMemo(() => {
    const sumFromResponses = responses?.reduce((sum, response) => {
      const questionPoints = response.quiz_questions?.points;
      if (questionPoints !== undefined && questionPoints !== null) {
        return sum + Number(questionPoints);
      }
      return sum + 1;
    }, 0) || 0;

    if (sumFromResponses > 0) {
      return sumFromResponses;
    }

    if (quiz.questions && quiz.questions.length) {
      const sum = quiz.questions.reduce<number>((acc, question) => acc + (question.points ?? 1), 0);
      if (sum > 0) {
        return sum;
      }
    }

    if (quiz.total_questions) {
      const numericTotal = Number(quiz.total_questions);
      if (!Number.isNaN(numericTotal) && numericTotal > 0) {
        return numericTotal;
      }
    }

    return responses?.length || 0;
  }, [quiz.questions, quiz.total_questions, responses]);

  // Sort participants by score (descending)
  const sortedParticipants = [...participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
  });

  const getRankIcon = (rank: number | null) => {
    if (rank === null) return null;
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-medium">#{rank}</span>;
  };

  const participantScore = participant?.score ?? 0;
  const participantPercentage =
    participant?.percentage_score != null
      ? participant.percentage_score
      : totalPossiblePoints > 0
        ? (participantScore / totalPossiblePoints) * 100
        : 0;

  return (
    <div className="space-y-6">
      {/* Participant's Results Summary Card */}
      {participant && (
        <Card>
          <CardHeader>
            <CardTitle>Your Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-2xl font-bold">
                  {participantScore} / {totalPossiblePoints || quiz.total_questions || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Percentage</p>
                <p className="text-2xl font-bold">
                  {participantPercentage != null
                    ? `${participantPercentage.toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rank</p>
                <div className="flex items-center gap-2">
                  {getRankIcon(participant.rank)}
                  {participant.rank && <span className="text-2xl font-bold">{participant.rank}</span>}
                </div>
              </div>
              {isSettled && (
                <div>
                  <p className="text-sm text-muted-foreground">Winnings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(participant.winnings, DEFAULT_CURRENCY)}
                  </p>
                </div>
              )}
            </div>

            <Progress 
              value={participantPercentage ?? 0}
              className="h-3" 
            />
          </CardContent>
        </Card>
      )}

      {/* Tabs for Answer Summary, Results, and Leaderboard */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="answers" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-none border-b">
              <TabsTrigger 
                value="answers" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Answer Summary</span>
                <span className="sm:hidden">Answers</span>
              </TabsTrigger>
              <TabsTrigger 
                value="leaderboard" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <List className="h-4 w-4" />
                <span>Leaderboard</span>
                {sortedParticipants.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                    {sortedParticipants.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Answer Summary Tab */}
            <TabsContent value="answers" className="mt-0 p-6">
              {responses && Array.isArray(responses) && responses.length > 0 ? (
                <div className="space-y-4">
                  {responses.map((response: any, index: number) => {
                    // Handle nested quiz_questions structure from API
                    const question = response.quiz_questions || (Array.isArray(response.quiz_questions) ? response.quiz_questions[0] : null);
                    const answers = question?.quiz_answers || [];
                    const selectedAnswer = answers.find((a: any) => a.id === response.answer_id);
                    const correctAnswer = answers.find((a: any) => a.is_correct);

                    if (!question || !question.question_text) {
                      return null;
                    }

                    return (
                      <div key={response.question_id || response.id || `response-${index}`} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-base">Question {index + 1}</p>
                            <p className="text-sm text-muted-foreground mt-1">{question.question_text}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {response.is_correct ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="text-sm font-medium">
                              {response.points_earned || 0} / {question.points || 1} pts
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 pl-4 border-l-2 border-muted">
                          <div className={`p-3 rounded-lg ${
                            response.is_correct 
                              ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' 
                              : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                          }`}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Your Answer</p>
                            <p className="text-sm font-medium">{selectedAnswer?.answer_text || 'No answer selected'}</p>
                          </div>
                          {!response.is_correct && correctAnswer && (
                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Correct Answer</p>
                              <p className="text-sm font-medium">{correctAnswer.answer_text}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {responses && responses.length === 0 
                      ? "No answers submitted yet" 
                      : "No answers available"}
                  </p>
                </div>
              )}
            </TabsContent>
            
            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard" className="mt-0 p-6">
              {sortedParticipants.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Top Performers</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{sortedParticipants.length} participant{sortedParticipants.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {sortedParticipants.map((p, index) => {
                    const isCurrentUser = participant && p.user_id === participant.user_id;
                    return (
                      <div
                        key={p.id || p.user_id || `participant-${index}`}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          isCurrentUser 
                            ? 'bg-primary/5 border-primary shadow-sm' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 flex items-center justify-center">
                            {getRankIcon(p.rank || index + 1)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-base">
                              {p.profiles?.username || 'Anonymous'}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs font-normal text-primary">(You)</span>
                              )}
                            </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>
                            {totalPossiblePoints > 0 
                              ? `${p.score ?? 0} / ${totalPossiblePoints} points`
                              : `${p.score ?? 0} pts`}
                          </span>
                          <span>
                            {p.percentage_score != null 
                              ? `${p.percentage_score.toFixed(1)}%` 
                              : totalPossiblePoints > 0 
                                ? `${(((p.score ?? 0) / totalPossiblePoints) * 100).toFixed(1)}%`
                                : '0%'}
                          </span>
                        </div>
                          </div>
                        </div>
                        {isSettled && p.winnings > 0 && (
                          <div className="text-right ml-4">
                            <p className="text-xs text-muted-foreground">Winnings</p>
                            <p className="font-bold text-green-600">
                              {formatCurrency(p.winnings, DEFAULT_CURRENCY)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No participants yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

