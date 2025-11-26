"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { Plus, X, Trash2, Loader2, Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

interface Question {
  id: string;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false';
  points: number;
  answers: Answer[];
}

interface Answer {
  id: string;
  answerText: string;
  isCorrect: boolean;
}

interface CreateQuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateQuizModal({ open, onOpenChange, onSuccess }: CreateQuizModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    entryFeePerQuestion: "",
    maxParticipants: "",
    totalQuestions: "",
    startDate: "",
    endDate: "",
    durationMinutes: "",
    randomizeQuestions: true,
    randomizeAnswers: true,
    showResultsImmediately: false,
    settlementMethod: 'proportional' as 'proportional' | 'top_winners' | 'equal_split',
    topWinnersCount: "",
  });

  const [questions, setQuestions] = useState<Question[]>([]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({
        title: "",
        description: "",
        entryFeePerQuestion: "",
        maxParticipants: "",
        totalQuestions: "",
        startDate: "",
        endDate: "",
        durationMinutes: "",
        randomizeQuestions: true,
        randomizeAnswers: true,
        showResultsImmediately: false,
        settlementMethod: 'proportional',
        topWinnersCount: "",
      });
      setQuestions([]);
      setSubmitting(false);
    }
  }, [open]);

  // Fetch user balance
  useEffect(() => {
    if (open && user) {
      const fetchBalance = async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setUserBalance(profile.balance || 0);
        }
      };
      fetchBalance();
    }
  }, [open, user, supabase]);

  // Calculate total cost
  const totalCost = useCallback(() => {
    const entryFee = parseFloat(formData.entryFeePerQuestion) || 0;
    const questions = parseFloat(formData.totalQuestions) || 0;
    const participants = parseFloat(formData.maxParticipants) || 0;
    return entryFee * questions * participants;
  }, [formData.entryFeePerQuestion, formData.totalQuestions, formData.maxParticipants]);

  // Update questions when totalQuestions changes
  useEffect(() => {
    const total = parseInt(formData.totalQuestions) || 0;
    if (total > 0 && questions.length !== total) {
      const newQuestions: Question[] = [];
      for (let i = 0; i < total; i++) {
        if (questions[i]) {
          newQuestions.push(questions[i]);
        } else {
          newQuestions.push({
            id: `q-${Date.now()}-${i}`,
            questionText: "",
            questionType: 'multiple_choice',
            points: 1,
            answers: [
              { id: `a-${Date.now()}-${i}-0`, answerText: "", isCorrect: false },
              { id: `a-${Date.now()}-${i}-1`, answerText: "", isCorrect: false },
            ],
          });
        }
      }
      setQuestions(newQuestions.slice(0, total));
    }
  }, [formData.totalQuestions]);

  const addAnswer = (questionIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].answers.push({
      id: `a-${Date.now()}-${questionIndex}-${newQuestions[questionIndex].answers.length}`,
      answerText: "",
      isCorrect: false,
    });
    setQuestions(newQuestions);
  };

  const removeAnswer = (questionIndex: number, answerIndex: number) => {
    const newQuestions = [...questions];
    if (newQuestions[questionIndex].answers.length > 2) {
      newQuestions[questionIndex].answers.splice(answerIndex, 1);
      setQuestions(newQuestions);
    } else {
      toast({
        title: "Minimum 2 answers required",
        description: "Each question must have at least 2 answer options.",
        variant: "destructive",
      });
    }
  };

  const setCorrectAnswer = (questionIndex: number, answerIndex: number) => {
    const newQuestions = [...questions];
    // Unset all other correct answers
    newQuestions[questionIndex].answers.forEach(a => a.isCorrect = false);
    // Set this one as correct
    newQuestions[questionIndex].answers[answerIndex].isCorrect = true;
    setQuestions(newQuestions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to create a quiz.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Validation
      if (!formData.title.trim() || formData.title.trim().length < 5) {
        toast({
          title: "Title required",
          description: "Quiz title must be at least 5 characters.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const entryFee = parseFloat(formData.entryFeePerQuestion);
      const maxParticipants = parseInt(formData.maxParticipants);
      const totalQuestions = parseInt(formData.totalQuestions);

      if (!entryFee || entryFee <= 0) {
        toast({
          title: "Invalid entry fee",
          description: "Entry fee per question must be greater than 0.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (!maxParticipants || maxParticipants <= 0) {
        toast({
          title: "Invalid participants",
          description: "Maximum participants must be greater than 0.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (!totalQuestions || totalQuestions <= 0) {
        toast({
          title: "Invalid questions",
          description: "Total questions must be greater than 0.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate questions
      if (questions.length !== totalQuestions) {
        toast({
          title: "Questions mismatch",
          description: `Please provide exactly ${totalQuestions} questions.`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.questionText.trim()) {
          toast({
            title: `Question ${i + 1} incomplete`,
            description: "Please provide question text.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }

        if (q.answers.length < 2) {
          toast({
            title: `Question ${i + 1} incomplete`,
            description: "Each question must have at least 2 answers.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }

        const correctAnswers = q.answers.filter(a => a.isCorrect);
        if (correctAnswers.length !== 1) {
          toast({
            title: `Question ${i + 1} incomplete`,
            description: "Each question must have exactly one correct answer.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }

        for (let j = 0; j < q.answers.length; j++) {
          if (!q.answers[j].answerText.trim()) {
            toast({
              title: `Question ${i + 1}, Answer ${j + 1} incomplete`,
              description: "Please provide answer text.",
              variant: "destructive",
            });
            setSubmitting(false);
            return;
          }
        }
      }

      // Check balance
      const cost = totalCost();
      if (userBalance === null || userBalance < cost) {
        toast({
          title: "Insufficient balance",
          description: `You need ${formatCurrency(cost, DEFAULT_CURRENCY)} to create this quiz. Your balance: ${formatCurrency(userBalance || 0, DEFAULT_CURRENCY)}`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Prepare questions data
      const questionsData = questions.map((q, index) => ({
        questionText: q.questionText.trim(),
        questionType: q.questionType,
        points: q.points,
        answers: q.answers.map(a => ({
          answerText: a.answerText.trim(),
          isCorrect: a.isCorrect,
        })),
      }));

      // Create quiz
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          entryFeePerQuestion: entryFee,
          maxParticipants,
          totalQuestions,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : null,
          randomizeQuestions: formData.randomizeQuestions,
          randomizeAnswers: formData.randomizeAnswers,
          showResultsImmediately: formData.showResultsImmediately,
          settlementMethod: formData.settlementMethod,
          topWinnersCount: formData.settlementMethod === 'top_winners' && formData.topWinnersCount 
            ? parseInt(formData.topWinnersCount) 
            : null,
          questions: questionsData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create quiz');
      }

      toast({
        title: "Quiz created!",
        description: "Your quiz has been created successfully. You can now invite participants.",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating quiz:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cost = totalCost();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-8xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Corporate Quiz</DialogTitle>
          <DialogDescription>
            Create a quiz for team building with monetary rewards. Participants will compete for prizes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Quiz Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Company Knowledge Quiz 2024"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your quiz..."
                rows={3}
              />
            </div>
          </div>

          {/* Quiz Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="entryFee">Entry Fee per Question (₦) *</Label>
              <Input
                id="entryFee"
                type="number"
                min="1"
                step="0.01"
                value={formData.entryFeePerQuestion}
                onChange={(e) => setFormData({ ...formData, entryFeePerQuestion: e.target.value })}
                placeholder="100"
                required
              />
            </div>

            <div>
              <Label htmlFor="maxParticipants">Max Participants *</Label>
              <Input
                id="maxParticipants"
                type="number"
                min="1"
                value={formData.maxParticipants}
                onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                placeholder="10"
                required
              />
            </div>

            <div>
              <Label htmlFor="totalQuestions">Total Questions *</Label>
              <Input
                id="totalQuestions"
                type="number"
                min="1"
                value={formData.totalQuestions}
                onChange={(e) => setFormData({ ...formData, totalQuestions: e.target.value })}
                placeholder="5"
                required
              />
            </div>
          </div>

          {/* Cost Calculation */}
          {cost > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    <span className="text-sm font-medium">Total Cost:</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{formatCurrency(cost, DEFAULT_CURRENCY)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formData.entryFeePerQuestion} × {formData.totalQuestions} × {formData.maxParticipants}
                    </div>
                    {userBalance !== null && (
                      <div className={`text-xs mt-1 ${userBalance >= cost ? 'text-green-600' : 'text-red-600'}`}>
                        Balance: {formatCurrency(userBalance, DEFAULT_CURRENCY)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="durationMinutes">Duration (Minutes, Optional)</Label>
            <Input
              id="durationMinutes"
              type="number"
              min="1"
              value={formData.durationMinutes}
              onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
              placeholder="30"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="randomizeQuestions">Randomize Questions</Label>
                <p className="text-xs text-muted-foreground">Prevent cheating by randomizing question order</p>
              </div>
              <Switch
                id="randomizeQuestions"
                checked={formData.randomizeQuestions}
                onCheckedChange={(checked) => setFormData({ ...formData, randomizeQuestions: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="randomizeAnswers">Randomize Answer Options</Label>
                <p className="text-xs text-muted-foreground">Randomize the order of answer choices</p>
              </div>
              <Switch
                id="randomizeAnswers"
                checked={formData.randomizeAnswers}
                onCheckedChange={(checked) => setFormData({ ...formData, randomizeAnswers: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="showResultsImmediately">Show Results Immediately</Label>
                <p className="text-xs text-muted-foreground">Show results to participants after completion</p>
              </div>
              <Switch
                id="showResultsImmediately"
                checked={formData.showResultsImmediately}
                onCheckedChange={(checked) => setFormData({ ...formData, showResultsImmediately: checked })}
              />
            </div>
          </div>

          {/* Settlement Method */}
          <div>
            <Label htmlFor="settlementMethod">Settlement Method</Label>
            <Select
              value={formData.settlementMethod}
              onValueChange={(value: 'proportional' | 'top_winners' | 'equal_split') => 
                setFormData({ ...formData, settlementMethod: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proportional">Proportional (Based on Score)</SelectItem>
                <SelectItem value="top_winners">Top Winners (Equal Split)</SelectItem>
                <SelectItem value="equal_split">Equal Split (All Participants)</SelectItem>
              </SelectContent>
            </Select>
            {formData.settlementMethod === 'top_winners' && (
              <div className="mt-2">
                <Label htmlFor="topWinnersCount">Number of Top Winners</Label>
                <Input
                  id="topWinnersCount"
                  type="number"
                  min="1"
                  value={formData.topWinnersCount}
                  onChange={(e) => setFormData({ ...formData, topWinnersCount: e.target.value })}
                  placeholder="3"
                />
              </div>
            )}
          </div>

          {/* Questions */}
          {questions.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Label>Questions ({questions.length})</Label>
              </div>

              {questions.map((question, qIndex) => (
                <Card key={question.id}>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Question {qIndex + 1}</h4>
                      <div className="flex items-center gap-2">
                        <Select
                          value={question.questionType}
                          onValueChange={(value: 'multiple_choice' | 'true_false') => {
                            const newQuestions = [...questions];
                            newQuestions[qIndex].questionType = value;
                            if (value === 'true_false' && newQuestions[qIndex].answers.length > 2) {
                              newQuestions[qIndex].answers = newQuestions[qIndex].answers.slice(0, 2);
                            }
                            setQuestions(newQuestions);
                          }}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                            <SelectItem value="true_false">True/False</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="1"
                          value={question.points}
                          onChange={(e) => {
                            const newQuestions = [...questions];
                            newQuestions[qIndex].points = parseFloat(e.target.value) || 1;
                            setQuestions(newQuestions);
                          }}
                          className="w-20"
                          placeholder="Points"
                        />
                      </div>
                    </div>

                    <Input
                      value={question.questionText}
                      onChange={(e) => {
                        const newQuestions = [...questions];
                        newQuestions[qIndex].questionText = e.target.value;
                        setQuestions(newQuestions);
                      }}
                      placeholder="Enter your question..."
                    />

                    <div className="space-y-2">
                      <Label>Answers</Label>
                      {question.answers.map((answer, aIndex) => (
                        <div key={answer.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            checked={answer.isCorrect}
                            onChange={() => setCorrectAnswer(qIndex, aIndex)}
                            className="h-4 w-4"
                          />
                          <Input
                            value={answer.answerText}
                            onChange={(e) => {
                              const newQuestions = [...questions];
                              newQuestions[qIndex].answers[aIndex].answerText = e.target.value;
                              setQuestions(newQuestions);
                            }}
                            placeholder={`Answer ${aIndex + 1}`}
                            className={answer.isCorrect ? 'border-green-500' : ''}
                          />
                          {question.answers.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAnswer(qIndex, aIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addAnswer(qIndex)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Answer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || cost === 0 || (userBalance !== null && userBalance < cost)}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create Quiz (${formatCurrency(cost, DEFAULT_CURRENCY)})`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

