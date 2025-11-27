"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  points: number;
  quiz_answers: Answer[];
}

interface Answer {
  id: string;
  answer_text: string;
  is_correct: boolean;
}

interface QuizTakingInterfaceProps {
  quizId: string;
  quizTitle: string;
  durationMinutes?: number;
  onComplete: (responses: any[]) => void;
}

export function QuizTakingInterface({
  quizId,
  quizTitle,
  durationMinutes,
  onComplete,
}: QuizTakingInterfaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    setHasStarted(false);
  }, [quizId]);

  // Start quiz
  useEffect(() => {
    let isMounted = true;
    const startQuiz = async () => {
      if (!user || hasStarted) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/quizzes/${quizId}/take`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to start quiz');
        }

        if (!isMounted) return;

        setQuestions(data.data?.questions || []);
        setStartTime(new Date());
        setHasStarted(true);
        
        if (durationMinutes) {
          setTimeRemaining(durationMinutes * 60);
        }
      } catch (error) {
        console.error('Error starting quiz:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to start quiz",
          variant: "destructive",
        });
        // Call onComplete with empty array to close the interface on error
        onComplete([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    startQuiz();

    return () => {
      isMounted = false;
    };
  }, [quizId, user, durationMinutes, hasStarted, toast, onComplete]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Auto-submit when time runs out
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const handleAnswerSelect = (questionId: string, answerId: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: answerId,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!user || submitting) return;

    setSubmitting(true);

    try {
      // Prepare responses array
      const responsesArray = Object.entries(responses).map(([questionId, answerId]) => ({
        questionId,
        answerId,
      }));

      const response = await fetch(`/api/quizzes/${quizId}/take`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          responses: responsesArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to submit quiz');
      }

      toast({
        title: "Quiz submitted!",
        description: "Your answers have been submitted successfully.",
      });

      onComplete(data.data?.responses || []);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit quiz",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [quizId, user, responses, submitting, toast, onComplete]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No questions available.</p>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(responses).length;
  const allAnswered = answeredCount === questions.length;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{quizTitle}</CardTitle>
            {timeRemaining !== null && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className={`font-mono ${timeRemaining < 60 ? 'text-red-600' : ''}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
              <span>{answeredCount} / {questions.length} answered</span>
            </div>
            <Progress value={progress} />
          </div>
        </CardHeader>
      </Card>

      {/* Question */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {currentQuestion.question_text}
              </h3>
              {currentQuestion.points > 1 && (
                <p className="text-sm text-muted-foreground">
                  Points: {currentQuestion.points}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {currentQuestion.quiz_answers?.map((answer) => {
                const isSelected = responses[currentQuestion.id] === answer.id;
                return (
                  <button
                    key={answer.id}
                    type="button"
                    onClick={() => handleAnswerSelect(currentQuestion.id, answer.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-primary bg-primary' : 'border-border'
                      }`}>
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span>{answer.answer_text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          {questions.map((_, index) => {
            const isAnswered = responses[questions[index].id] !== undefined;
            const isCurrent = index === currentQuestionIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentQuestionIndex(index)}
                className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-sm ${
                  isCurrent
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isAnswered
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        {currentQuestionIndex < questions.length - 1 ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting || !allAnswered}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit Quiz
                <CheckCircle2 className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>

      {!allAnswered && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="pt-4">
            <p className="text-sm text-yellow-800">
              Please answer all questions before submitting.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

