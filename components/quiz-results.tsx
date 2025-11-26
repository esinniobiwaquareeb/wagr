"use client";

import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { Trophy, Medal, Award, TrendingUp, Users, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

interface Participant {
  id: string;
  user_id: string;
  score: number;
  percentage_score: number;
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
  const totalPossiblePoints = quiz.total_questions; // Assuming 1 point per question by default

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

  return (
    <div className="space-y-6">
      {/* Participant's Results */}
      {participant && (
        <Card>
          <CardHeader>
            <CardTitle>Your Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-2xl font-bold">{participant.score} / {totalPossiblePoints}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Percentage</p>
                <p className="text-2xl font-bold">{participant.percentage_score.toFixed(1)}%</p>
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

            <Progress value={participant.percentage_score} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Detailed Responses */}
      {showDetails && responses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Answers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {responses.map((response, index) => {
              const question = response.quiz_questions;
              const selectedAnswer = question?.quiz_answers?.find(a => a.id === response.answer_id);
              const correctAnswer = question?.quiz_answers?.find(a => a.is_correct);

              return (
                <div key={response.question_id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Question {index + 1}</p>
                      <p className="text-sm text-muted-foreground">{question?.question_text}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {response.is_correct ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm font-medium">
                        {response.points_earned} / {question?.points || 1} pts
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 pl-4">
                    <div className={`p-2 rounded ${
                      response.is_correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <p className="text-xs text-muted-foreground">Your Answer</p>
                      <p className="text-sm">{selectedAnswer?.answer_text || 'No answer'}</p>
                    </div>
                    {!response.is_correct && correctAnswer && (
                      <div className="p-2 rounded bg-green-50 border border-green-200">
                        <p className="text-xs text-muted-foreground">Correct Answer</p>
                        <p className="text-sm">{correctAnswer.answer_text}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {sortedParticipants.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Leaderboard</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{sortedParticipants.length} participants</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedParticipants.map((p, index) => {
                const isCurrentUser = participant && p.user_id === participant.user_id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isCurrentUser ? 'bg-primary/5 border-primary' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 flex items-center justify-center">
                        {getRankIcon(p.rank || index + 1)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {p.profiles?.username || 'Anonymous'}
                          {isCurrentUser && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{p.score} / {totalPossiblePoints} points</span>
                          <span>{p.percentage_score.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    {isSettled && p.winnings > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Winnings</p>
                        <p className="font-bold text-green-600">
                          {formatCurrency(p.winnings, DEFAULT_CURRENCY)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settlement Info */}
      {isSettled && quiz.settled_at && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Quiz settled on {format(new Date(quiz.settled_at), 'PPp')}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

