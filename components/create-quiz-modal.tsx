"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { useSettings } from "@/hooks/use-settings";
import { Plus, X, Trash2, Loader2, Calculator, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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

function normalizeAnswerSet(answers: Answer[]): Answer[] {
  if (!answers.length) return [];

  const normalized = answers.map((answer) => ({
    ...answer,
    isCorrect: Boolean(answer.isCorrect),
    answerText: answer.answerText,
  }));

  const correctCount = normalized.filter((answer) => answer.isCorrect).length;

  if (correctCount === 0) {
    normalized[0].isCorrect = true;
  } else if (correctCount > 1) {
    let seen = false;
    normalized.forEach((answer) => {
      if (answer.isCorrect) {
        if (seen) {
          answer.isCorrect = false;
        } else {
          seen = true;
        }
      }
    });
  }

  return normalized;
}

interface CreateQuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  quizId?: string; // If provided, this is edit mode
  initialData?: {
    title: string;
    description?: string;
    entryFeePerQuestion: number;
    maxParticipants: number;
    totalQuestions: number;
    startDate?: string;
    endDate?: string;
    durationMinutes?: number;
    randomizeQuestions: boolean;
    randomizeAnswers: boolean;
    showResultsImmediately: boolean;
    settlementMethod: 'proportional' | 'top_winners' | 'equal_split';
    topWinnersCount?: number;
    questions?: Array<{
      questionText: string;
      questionType: 'multiple_choice' | 'true_false';
      points: number;
      answers: Array<{
        answerText: string;
        isCorrect: boolean;
      }>;
    }>;
  };
}

export function CreateQuizModal({ open, onOpenChange, onSuccess, quizId, initialData }: CreateQuizModalProps) {
  const isEditMode = !!quizId && !!initialData;
  const { user } = useAuth();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const { getSetting, getQuizLimits, loading: settingsLoading } = useSettings();
  
  // Get platform fee from settings (default to 10% if not loaded yet)
  const PLATFORM_FEE_PERCENTAGE = settingsLoading ? 0.10 : (getSetting('fees.quiz_platform_fee_percentage', 0.10) as number);
  const quizLimits = getQuizLimits();

  const totalSteps = 3;

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
      setCurrentStep(1);
    }
  }, [open]);

  // Populate form when initialData is provided (edit mode)
  useEffect(() => {
    if (open && initialData && isEditMode) {
      // Format dates for datetime-local inputs
      const formatDateTimeLocal = (dateString?: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        entryFeePerQuestion: initialData.entryFeePerQuestion?.toString() || "",
        maxParticipants: initialData.maxParticipants?.toString() || "",
        totalQuestions: initialData.totalQuestions?.toString() || "",
        startDate: formatDateTimeLocal(initialData.startDate),
        endDate: formatDateTimeLocal(initialData.endDate),
        durationMinutes: initialData.durationMinutes?.toString() || "",
        randomizeQuestions: initialData.randomizeQuestions ?? true,
        randomizeAnswers: initialData.randomizeAnswers ?? true,
        showResultsImmediately: initialData.showResultsImmediately ?? false,
        settlementMethod: initialData.settlementMethod || 'proportional',
        topWinnersCount: initialData.topWinnersCount?.toString() || "",
      });

      // Populate questions
      if (initialData.questions && initialData.questions.length > 0) {
        const formattedQuestions: Question[] = initialData.questions.map((q, index) => ({
          id: `q-edit-${index}`,
          questionText: q.questionText || "",
          questionType: q.questionType || 'multiple_choice',
          points: q.points || 1,
          answers: normalizeAnswerSet(
            q.answers.map((a, aIndex) => ({
              id: `a-edit-${index}-${aIndex}`,
              answerText: a.answerText || "",
              isCorrect: a.isCorrect || false,
            }))
          ),
        }));
        setQuestions(formattedQuestions);
      }
    }
  }, [open, initialData, isEditMode]);

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

  // Calculate total cost (base cost + platform fee)
  // Get platform fee from settings (default to 10% if not loaded yet)
  const platformFeePercentage = settingsLoading ? 0.10 : (getSetting('fees.quiz_platform_fee_percentage', 0.10) as number);
  
  const totalCost = useCallback(() => {
    const entryFee = parseFloat(formData.entryFeePerQuestion) || 0;
    const questions = parseFloat(formData.totalQuestions) || 0;
    const participants = parseFloat(formData.maxParticipants) || 0;
    const baseCost = entryFee * questions * participants;
    const platformFee = baseCost * platformFeePercentage;
    return baseCost + platformFee;
  }, [formData.entryFeePerQuestion, formData.totalQuestions, formData.maxParticipants, platformFeePercentage]);

  const baseCost = useCallback(() => {
    const entryFee = parseFloat(formData.entryFeePerQuestion) || 0;
    const questions = parseFloat(formData.totalQuestions) || 0;
    const participants = parseFloat(formData.maxParticipants) || 0;
    return entryFee * questions * participants;
  }, [formData.entryFeePerQuestion, formData.totalQuestions, formData.maxParticipants]);

  // Update questions when totalQuestions changes (only in create mode, not edit mode)
  useEffect(() => {
    // Don't auto-update questions if we're in edit mode and have initial data
    if (isEditMode && initialData) {
      return;
    }
    
    const total = parseInt(formData.totalQuestions) || 0;
    if (total > 0 && questions.length !== total) {
      const newQuestions: Question[] = [];
      for (let i = 0; i < total; i++) {
        if (questions[i]) {
          newQuestions.push({
            ...questions[i],
            answers: normalizeAnswerSet(questions[i].answers),
          });
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
  }, [formData.totalQuestions, isEditMode, questions, initialData]);

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

  // Step validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.title.trim() || formData.title.trim().length < 5) {
          toast({
            title: "Title required",
            description: "Quiz title must be at least 5 characters.",
            variant: "destructive",
          });
          return false;
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
          return false;
        }

        if (entryFee < quizLimits.minEntryFeePerQuestion) {
          toast({
            title: "Entry fee too low",
            description: `Minimum entry fee per question is ₦${quizLimits.minEntryFeePerQuestion}.`,
            variant: "destructive",
          });
          return false;
        }

        if (entryFee > quizLimits.maxEntryFeePerQuestion) {
          toast({
            title: "Entry fee too high",
            description: `Maximum entry fee per question is ₦${quizLimits.maxEntryFeePerQuestion}.`,
            variant: "destructive",
          });
          return false;
        }

        if (!maxParticipants || maxParticipants <= 0) {
          toast({
            title: "Invalid participants",
            description: "Maximum participants must be greater than 0.",
            variant: "destructive",
          });
          return false;
        }

        if (maxParticipants < quizLimits.minParticipants) {
          toast({
            title: "Too few participants",
            description: `Minimum participants is ${quizLimits.minParticipants}.`,
            variant: "destructive",
          });
          return false;
        }

        if (maxParticipants > quizLimits.maxParticipants) {
          toast({
            title: "Too many participants",
            description: `Maximum participants is ${quizLimits.maxParticipants}.`,
            variant: "destructive",
          });
          return false;
        }

        if (!totalQuestions || totalQuestions <= 0) {
          toast({
            title: "Invalid questions",
            description: "Total questions must be greater than 0.",
            variant: "destructive",
          });
          return false;
        }

        if (totalQuestions < quizLimits.minQuestions) {
          toast({
            title: "Too few questions",
            description: `Minimum questions is ${quizLimits.minQuestions}.`,
            variant: "destructive",
          });
          return false;
        }

        if (totalQuestions > quizLimits.maxQuestions) {
          toast({
            title: "Too many questions",
            description: `Maximum questions is ${quizLimits.maxQuestions}.`,
            variant: "destructive",
          });
          return false;
        }

        const cost = totalCost();
        if (userBalance !== null && userBalance < cost) {
          toast({
            title: "Insufficient balance",
            description: `You need ${formatCurrency(cost, DEFAULT_CURRENCY)} to create this quiz. Your balance: ${formatCurrency(userBalance || 0, DEFAULT_CURRENCY)}`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      
      case 2:
        if (formData.settlementMethod === 'top_winners' && (!formData.topWinnersCount || parseInt(formData.topWinnersCount) <= 0)) {
          toast({
            title: "Invalid top winners count",
            description: "Please specify the number of top winners.",
            variant: "destructive",
          });
          return false;
        }
        
        // Quiz deadline is mandatory
        if (!formData.endDate || !formData.endDate.trim()) {
          toast({
            title: "Deadline required",
            description: "Please set a deadline for the quiz.",
            variant: "destructive",
          });
          return false;
        }
        
        return true;
      
      case 3:
        const total = parseInt(formData.totalQuestions) || 0;
        if (questions.length !== total) {
          toast({
            title: "Questions mismatch",
            description: `Please provide exactly ${total} questions.`,
            variant: "destructive",
          });
          return false;
        }

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (!q.questionText.trim()) {
            toast({
              title: `Question ${i + 1} incomplete`,
              description: "Please provide question text.",
              variant: "destructive",
            });
            return false;
          }

          if (q.answers.length < 2) {
            toast({
              title: `Question ${i + 1} incomplete`,
              description: "Each question must have at least 2 answers.",
              variant: "destructive",
            });
            return false;
          }

          const correctAnswers = q.answers.filter(a => a.isCorrect);
          if (correctAnswers.length !== 1) {
            toast({
              title: `Question ${i + 1} incomplete`,
              description: "Each question must have exactly one correct answer.",
              variant: "destructive",
            });
            return false;
          }

          for (let j = 0; j < q.answers.length; j++) {
            if (!q.answers[j].answerText.trim()) {
              toast({
                title: `Question ${i + 1}, Answer ${j + 1} incomplete`,
                description: "Please provide answer text.",
                variant: "destructive",
              });
              return false;
            }
          }
        }
        return true;
      
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to create a quiz.",
        variant: "destructive",
      });
      return;
    }

    if (!validateStep(5)) {
      return;
    }

    setSubmitting(true);

    try {
      const entryFee = parseFloat(formData.entryFeePerQuestion);
      const maxParticipants = parseInt(formData.maxParticipants);
      const totalQuestions = parseInt(formData.totalQuestions);

      // Prepare questions data
      const questionsData = questions.map((q, index) => ({
        questionText: q.questionText.trim(),
        questionType: q.questionType,
        points: q.points,
        answers: normalizeAnswerSet(q.answers).map(a => ({
          answerText: a.answerText.trim(),
          isCorrect: a.isCorrect,
        })),
      }));

      // Create or update quiz
      const url = isEditMode ? `/api/quizzes/${quizId}` : '/api/quizzes';
      const method = isEditMode ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
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

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('balance-updated'));
      }

      toast({
        title: isEditMode ? "Quiz updated!" : "Quiz created!",
        description: isEditMode 
          ? "Your quiz has been updated successfully."
          : "Your quiz has been created successfully. You can now invite participants.",
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
  const progress = (currentStep / totalSteps) * 100;

  const stepTitles = [
    "Basic Info & Settings",
    "Options & Settlement",
    "Questions & Answers"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Quiz' : 'Create Corporate Quiz'}</DialogTitle>
          <DialogDescription>
            Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b">
          {stepTitles.map((title, index) => {
            const stepNum = index + 1;
            const isActive = stepNum === currentStep;
            const isCompleted = stepNum < currentStep;
            return (
              <div
                key={stepNum}
                className={`flex flex-col items-center flex-1 ${
                  isActive ? 'text-primary' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-border bg-background'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{stepNum}</span>
                  )}
                </div>
                <span className="text-xs mt-1 text-center hidden md:block">{title}</span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto pr-2">
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
            {/* Step 1: Basic Info & Settings */}
            {currentStep === 1 && (
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
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            <span className="text-sm font-medium">Cost Breakdown</span>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Base Cost:</span>
                            <span>{formatCurrency(baseCost(), DEFAULT_CURRENCY)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Platform Fee ({Math.round(PLATFORM_FEE_PERCENTAGE * 100)}%):</span>
                            <span>{formatCurrency(baseCost() * PLATFORM_FEE_PERCENTAGE, DEFAULT_CURRENCY)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t font-semibold">
                            <span>Total Cost:</span>
                            <span className="text-lg">{formatCurrency(cost, DEFAULT_CURRENCY)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground pt-1">
                            {formData.entryFeePerQuestion} × {formData.totalQuestions} × {formData.maxParticipants} + {PLATFORM_FEE_PERCENTAGE * 100}%
                          </div>
                          {userBalance !== null && (
                            <div className={`text-xs mt-2 pt-2 border-t ${userBalance >= cost ? 'text-green-600' : 'text-red-600'}`}>
                              Your Balance: {formatCurrency(userBalance, DEFAULT_CURRENCY)}
                              {userBalance < cost && (
                                <span className="block mt-1">Insufficient balance. You need {formatCurrency(cost - userBalance, DEFAULT_CURRENCY)} more.</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 2: Options & Settlement */}
            {currentStep === 2 && (
              <div className="space-y-4">
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

                <div className="space-y-3 pt-4 border-t">
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

                <div className="pt-4 border-t">
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
                  <Card className="bg-muted/50 mt-2">
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">
                        <strong>Proportional:</strong> Winnings distributed based on each participant's score percentage.
                        <br />
                        <strong>Top Winners:</strong> Only the top N winners split the prize pool equally.
                        <br />
                        <strong>Equal Split:</strong> All participants who complete the quiz split the prize pool equally.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Step 3: Questions & Answers */}
            {currentStep === 3 && (
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
                        {question.questionType === 'multiple_choice' && (
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
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
          </div>

          {currentStep < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              className="min-w-[120px]"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || cost === 0 || (userBalance !== null && userBalance < cost)}
              className="min-w-[180px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  {isEditMode ? 'Update Quiz' : 'Create Quiz'}
                  {!isEditMode && (
                    <span className="ml-2 text-xs opacity-90">
                      ({formatCurrency(cost, DEFAULT_CURRENCY)})
                    </span>
                  )}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
