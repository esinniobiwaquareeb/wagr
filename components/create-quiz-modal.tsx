"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
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
import { logger } from "@/lib/logger";
import { utcToLocal, localToUTC, isDeadlineValid } from "@/lib/deadline-utils";

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
  const [submitting, setSubmitting] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const { getSetting, getQuizLimits, loading: settingsLoading } = useSettings();
  const formInitializedRef = useRef<string | null>(null);
  
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

  // Reset form when modal closes (but not when opening in edit mode)
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
      formInitializedRef.current = null; // Reset flag when modal closes
    } else if (open && !isEditMode) {
      // Reset form when opening in create mode (not edit mode)
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
      setCurrentStep(1);
      formInitializedRef.current = null;
    }
  }, [open, isEditMode]);

  // Populate form when initialData is provided (edit mode) - only once per quiz when modal opens
  useEffect(() => {
    if (open && initialData && isEditMode && quizId && formInitializedRef.current !== quizId) {
      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        entryFeePerQuestion: initialData.entryFeePerQuestion?.toString() || "",
        maxParticipants: initialData.maxParticipants?.toString() || "",
        totalQuestions: initialData.totalQuestions?.toString() || "",
        startDate: utcToLocal(initialData.startDate),
        endDate: utcToLocal(initialData.endDate),
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
      
      formInitializedRef.current = quizId; // Mark as initialized for this quiz
    }
  }, [open, quizId, isEditMode, initialData]); // Include initialData but check quizId to prevent re-runs

  // Fetch user balance
  useEffect(() => {
    if (open && user) {
      const fetchBalance = async () => {
        try {
          const { walletApi } = await import('@/lib/api-client');
          const response = await walletApi.getBalance();
          setUserBalance(response.balance || 0);
        } catch (error) {
          logger.error('Error fetching balance', error);
          setUserBalance(0);
        }
      };
      fetchBalance();
    }
  }, [open, user]);

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

  // Check if amount-related fields have changed in edit mode
  const hasAmountFieldsChanged = useMemo(() => {
    if (!isEditMode || !initialData) return false;
    return (
      parseFloat(formData.entryFeePerQuestion) !== (initialData.entryFeePerQuestion || 0) ||
      parseInt(formData.maxParticipants) !== (initialData.maxParticipants || 0) ||
      parseInt(formData.totalQuestions) !== (initialData.totalQuestions || 0)
    );
  }, [isEditMode, initialData, formData.entryFeePerQuestion, formData.maxParticipants, formData.totalQuestions]);

  // Determine if balance validation should be applied
  const shouldValidateBalance = useMemo(() => {
    return !isEditMode || hasAmountFieldsChanged;
  }, [isEditMode, hasAmountFieldsChanged]);

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

        if (shouldValidateBalance) {
          const cost = totalCost();
          if (userBalance !== null && userBalance < cost) {
            toast({
              title: "Insufficient balance",
              description: `You need ${formatCurrency(cost, DEFAULT_CURRENCY)} to ${isEditMode ? 'update' : 'create'} this quiz. Your balance: ${formatCurrency(userBalance || 0, DEFAULT_CURRENCY)}`,
              variant: "destructive",
            });
            return false;
          }
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
        
        // Quiz end date is mandatory
        if (!formData.endDate || !formData.endDate.trim()) {
          toast({
            title: "End date required",
            description: "Please set an end date for the quiz.",
            variant: "destructive",
          });
          return false;
        }

        // Validate end date is after start date (if start date is provided)
        if (formData.startDate && formData.endDate) {
          const startDate = new Date(formData.startDate);
          const endDate = new Date(formData.endDate);
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            toast({
              title: "Invalid date format",
              description: "Please enter valid dates.",
              variant: "destructive",
            });
            return false;
          }
          if (endDate <= startDate) {
            toast({
              title: "Invalid date range",
              description: "End date must be after start date.",
              variant: "destructive",
            });
            return false;
          }
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

    if (!validateStep(3)) {
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

      // Validate end date is in the future (if provided)
      if (formData.endDate && !isDeadlineValid(formData.endDate)) {
        toast({
          title: "Invalid end date",
          description: "End date must be in the future.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate start date is in the future (if provided)
      if (formData.startDate && !isDeadlineValid(formData.startDate)) {
        toast({
          title: "Invalid start date",
          description: "Start date must be in the future.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate end date is after start date (if both provided)
      if (formData.startDate && formData.endDate) {
        const startDate = new Date(formData.startDate);
        const endDate = new Date(formData.endDate);
        if (endDate <= startDate) {
          toast({
            title: "Invalid date range",
            description: "End date must be after start date.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      // Convert local datetime to UTC ISO strings
      const startDateUTC = localToUTC(formData.startDate);
      const endDateUTC = localToUTC(formData.endDate);

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
          startDate: startDateUTC,
          endDate: endDateUTC,
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
      logger.error("Error creating quiz", error);
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
      <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6">
        <DialogHeader className="px-4 sm:px-0 pt-4 sm:pt-0">
          <DialogTitle className="text-xl sm:text-2xl">{isEditMode ? 'Edit Quiz' : 'Create Corporate Quiz'}</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2 mb-4 sm:mb-6 px-4 sm:px-0">
          <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b px-4 sm:px-0 gap-2">
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
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-md'
                      : isCompleted
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-border bg-background'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <span className="text-sm sm:text-base font-semibold">{stepNum}</span>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs mt-1.5 text-center line-clamp-2">{title}</span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 px-4 sm:px-0">
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-4 sm:space-y-6">
            {/* Step 1: Basic Info & Settings */}
            {currentStep === 1 && (
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <Label htmlFor="title" className="text-sm sm:text-base font-semibold mb-2 block">
                    Quiz Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Company Knowledge Quiz 2024"
                    className="text-sm sm:text-base h-10 sm:h-11"
                    required
                  />
                  {formData.title && formData.title.trim().length < 5 && (
                    <p className="text-xs text-red-500 mt-1">Title must be at least 5 characters</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm sm:text-base font-semibold mb-2 block">
                    Description <span className="text-muted-foreground text-xs">(Optional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your quiz..."
                    rows={3}
                    className="text-sm sm:text-base resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="entryFee" className="text-sm sm:text-base font-semibold mb-2 block">
                      Entry Fee per Question (₦) <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm sm:text-base">
                        ₦
                      </span>
                      <Input
                        id="entryFee"
                        type="number"
                        min={quizLimits.minEntryFeePerQuestion}
                        max={quizLimits.maxEntryFeePerQuestion}
                        step="0.01"
                        value={formData.entryFeePerQuestion}
                        onChange={(e) => setFormData({ ...formData, entryFeePerQuestion: e.target.value })}
                        placeholder={`Min: ₦${quizLimits.minEntryFeePerQuestion}`}
                        className="pl-8 text-sm sm:text-base h-10 sm:h-11"
                        required
                        inputMode="decimal"
                      />
                    </div>
                    {formData.entryFeePerQuestion && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Range: ₦{quizLimits.minEntryFeePerQuestion} - ₦{quizLimits.maxEntryFeePerQuestion}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="maxParticipants" className="text-sm sm:text-base font-semibold mb-2 block">
                      Max Participants <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="maxParticipants"
                      type="number"
                      min={quizLimits.minParticipants}
                      max={quizLimits.maxParticipants}
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                      placeholder={`Min: ${quizLimits.minParticipants}`}
                      className="text-sm sm:text-base h-10 sm:h-11"
                      required
                      inputMode="numeric"
                    />
                    {formData.maxParticipants && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Range: {quizLimits.minParticipants} - {quizLimits.maxParticipants}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="totalQuestions" className="text-sm sm:text-base font-semibold mb-2 block">
                      Total Questions <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="totalQuestions"
                      type="number"
                      min={quizLimits.minQuestions}
                      max={quizLimits.maxQuestions}
                      value={formData.totalQuestions}
                      onChange={(e) => setFormData({ ...formData, totalQuestions: e.target.value })}
                      placeholder={`Min: ${quizLimits.minQuestions}`}
                      className="text-sm sm:text-base h-10 sm:h-11"
                      required
                      inputMode="numeric"
                    />
                    {formData.totalQuestions && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Range: {quizLimits.minQuestions} - {quizLimits.maxQuestions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Cost Calculation */}
                {cost > 0 && (
                  <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-background dark:from-primary/10 dark:via-primary/5 dark:to-background border-primary/20">
                    <CardContent className="pt-4 sm:pt-5">
                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            <span className="text-sm sm:text-base font-semibold">Cost Breakdown</span>
                          </div>
                        </div>
                        <div className="space-y-2.5 text-sm sm:text-base">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Base Cost:</span>
                            <span className="font-medium">{formatCurrency(baseCost(), DEFAULT_CURRENCY)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Platform Fee ({Math.round(PLATFORM_FEE_PERCENTAGE * 100)}%):</span>
                            <span className="font-medium">{formatCurrency(baseCost() * PLATFORM_FEE_PERCENTAGE, DEFAULT_CURRENCY)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2.5 border-t border-primary/20 font-bold">
                            <span className="text-base sm:text-lg">Total Cost:</span>
                            <span className="text-lg sm:text-xl text-primary">{formatCurrency(cost, DEFAULT_CURRENCY)}</span>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground pt-1.5 bg-muted/30 p-2 rounded-md">
                            <span className="font-medium">Calculation:</span> ₦{formData.entryFeePerQuestion || 0} × {formData.totalQuestions || 0} questions × {formData.maxParticipants || 0} participants + {Math.round(PLATFORM_FEE_PERCENTAGE * 100)}% fee
                          </div>
                          {userBalance !== null && shouldValidateBalance && (
                            <div className={`text-xs sm:text-sm mt-2.5 pt-2.5 border-t border-primary/20 font-medium ${userBalance >= cost ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              <div className="flex justify-between items-center mb-1">
                                <span>Your Balance:</span>
                                <span className="font-semibold">{formatCurrency(userBalance, DEFAULT_CURRENCY)}</span>
                              </div>
                              {userBalance < cost && (
                                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
                                  <span className="block">⚠️ Insufficient balance</span>
                                  <span className="block mt-1">You need {formatCurrency(cost - userBalance, DEFAULT_CURRENCY)} more to {isEditMode ? 'update' : 'create'} this quiz.</span>
                                </div>
                              )}
                              {userBalance >= cost && (
                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
                                  <span className="block">✓ Sufficient balance</span>
                                  <span className="block mt-1 text-xs">Remaining after quiz: {formatCurrency(userBalance - cost, DEFAULT_CURRENCY)}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {isEditMode && !shouldValidateBalance && userBalance !== null && (
                            <div className="text-xs sm:text-sm mt-2.5 pt-2.5 border-t border-primary/20 text-muted-foreground">
                              <span>Balance check skipped - no amount changes detected</span>
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
              <div className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate" className="text-sm sm:text-base font-semibold mb-2 block">
                      Start Date <span className="text-muted-foreground text-xs">(Optional)</span>
                    </Label>
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="text-sm sm:text-base h-10 sm:h-11"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    {formData.startDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Quiz will start: {new Date(formData.startDate).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="endDate" className="text-sm sm:text-base font-semibold mb-2 block">
                      End Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={formData.endDate}
                      required
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="text-sm sm:text-base h-10 sm:h-11"
                      min={formData.startDate || new Date().toISOString().slice(0, 16)}
                    />
                    {formData.endDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Quiz will end: {new Date(formData.endDate).toLocaleString()}
                      </p>
                    )}
                    {formData.startDate && formData.endDate && new Date(formData.endDate) <= new Date(formData.startDate) && (
                      <p className="text-xs text-red-500 mt-1">End date must be after start date</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="durationMinutes" className="text-sm sm:text-base font-semibold mb-2 block">
                    Duration (Minutes) <span className="text-muted-foreground text-xs">(Optional)</span>
                  </Label>
                  <Input
                    id="durationMinutes"
                    type="number"
                    min="1"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    placeholder="e.g., 30 minutes per participant"
                    className="text-sm sm:text-base h-10 sm:h-11"
                    inputMode="numeric"
                  />
                  {formData.durationMinutes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Each participant will have {formData.durationMinutes} minutes to complete the quiz
                    </p>
                  )}
                </div>

                <div className="space-y-3 sm:space-y-4 pt-4 border-t">
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <h3 className="text-sm sm:text-base font-semibold mb-3">Quiz Settings</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <Label htmlFor="randomizeQuestions" className="text-sm sm:text-base font-medium cursor-pointer">
                              Randomize Questions
                            </Label>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                              Prevent cheating by randomizing question order for each participant
                            </p>
                          </div>
                          <Switch
                            id="randomizeQuestions"
                            checked={formData.randomizeQuestions}
                            onCheckedChange={(checked) => setFormData({ ...formData, randomizeQuestions: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <Label htmlFor="randomizeAnswers" className="text-sm sm:text-base font-medium cursor-pointer">
                              Randomize Answer Options
                            </Label>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                              Randomize the order of answer choices for each question
                            </p>
                          </div>
                          <Switch
                            id="randomizeAnswers"
                            checked={formData.randomizeAnswers}
                            onCheckedChange={(checked) => setFormData({ ...formData, randomizeAnswers: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <Label htmlFor="showResultsImmediately" className="text-sm sm:text-base font-medium cursor-pointer">
                              Show Results Immediately
                            </Label>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                              Show results and correct answers to participants immediately after completion
                            </p>
                          </div>
                          <Switch
                            id="showResultsImmediately"
                            checked={formData.showResultsImmediately}
                            onCheckedChange={(checked) => setFormData({ ...formData, showResultsImmediately: checked })}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="pt-4 border-t">
                  <Label htmlFor="settlementMethod" className="text-sm sm:text-base font-semibold mb-2 block">
                    Settlement Method
                  </Label>
                  <Select
                    value={formData.settlementMethod}
                    onValueChange={(value: 'proportional' | 'top_winners' | 'equal_split') => 
                      setFormData({ ...formData, settlementMethod: value, topWinnersCount: value === 'top_winners' ? formData.topWinnersCount : '' })
                    }
                  >
                    <SelectTrigger className="h-10 sm:h-11 text-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proportional">Proportional (Based on Score)</SelectItem>
                      <SelectItem value="top_winners">Top Winners (Equal Split)</SelectItem>
                      <SelectItem value="equal_split">Equal Split (All Participants)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.settlementMethod === 'top_winners' && (
                    <div className="mt-3">
                      <Label htmlFor="topWinnersCount" className="text-sm sm:text-base font-semibold mb-2 block">
                        Number of Top Winners <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="topWinnersCount"
                        type="number"
                        min="1"
                        max={parseInt(formData.maxParticipants) || 100}
                        value={formData.topWinnersCount}
                        onChange={(e) => setFormData({ ...formData, topWinnersCount: e.target.value })}
                        placeholder="e.g., 3"
                        className="text-sm sm:text-base h-10 sm:h-11"
                        inputMode="numeric"
                      />
                      {formData.maxParticipants && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum: {formData.maxParticipants} (based on max participants)
                        </p>
                      )}
                    </div>
                  )}
                  <Card className="bg-muted/50 mt-3 border-primary/20">
                    <CardContent className="pt-4">
                      <div className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
                        <div><strong className="text-foreground">Proportional:</strong> Winnings distributed based on each participant's score percentage. Higher scores = larger share.</div>
                        <div><strong className="text-foreground">Top Winners:</strong> Only the top N winners split the prize pool equally. Best for competitive quizzes.</div>
                        <div><strong className="text-foreground">Equal Split:</strong> All participants who complete the quiz split the prize pool equally. Best for team building.</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Step 3: Questions & Answers */}
            {currentStep === 3 && (
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base sm:text-lg font-semibold">
                    Questions ({questions.length})
                  </Label>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {questions.filter(q => q.questionText.trim() && q.answers.filter(a => a.answerText.trim() && a.isCorrect).length === 1).length} / {questions.length} complete
                  </span>
                </div>

                {questions.map((question, qIndex) => {
                  const hasQuestionText = question.questionText.trim().length > 0;
                  const hasCorrectAnswer = question.answers.filter(a => a.isCorrect && a.answerText.trim()).length === 1;
                  const allAnswersFilled = question.answers.every(a => a.answerText.trim().length > 0);
                  const isComplete = hasQuestionText && hasCorrectAnswer && allAnswersFilled;

                  return (
                    <Card key={question.id} className={isComplete ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/10' : ''}>
                      <CardContent className="pt-4 sm:pt-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                              isComplete 
                                ? 'bg-green-500 text-white' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {isComplete ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : qIndex + 1}
                            </div>
                            <h4 className="font-semibold text-sm sm:text-base">Question {qIndex + 1}</h4>
                          </div>
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
                              <SelectTrigger className="w-36 sm:w-40 h-9 sm:h-10 text-xs sm:text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                <SelectItem value="true_false">True/False</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="relative">
                              <Input
                                type="number"
                                min="1"
                                value={question.points}
                                onChange={(e) => {
                                  const newQuestions = [...questions];
                                  newQuestions[qIndex].points = parseFloat(e.target.value) || 1;
                                  setQuestions(newQuestions);
                                }}
                                className="w-16 sm:w-20 h-9 sm:h-10 text-xs sm:text-sm"
                                placeholder="Pts"
                                inputMode="numeric"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <Textarea
                            value={question.questionText}
                            onChange={(e) => {
                              const newQuestions = [...questions];
                              newQuestions[qIndex].questionText = e.target.value;
                              setQuestions(newQuestions);
                            }}
                            placeholder="Enter your question..."
                            className="text-sm sm:text-base min-h-[80px] resize-none"
                            rows={3}
                          />
                          {!hasQuestionText && (
                            <p className="text-xs text-red-500 mt-1">Question text is required</p>
                          )}
                        </div>

                        <div className="space-y-2.5">
                          <Label className="text-sm sm:text-base font-semibold">
                            Answers {question.questionType === 'true_false' && <span className="text-xs text-muted-foreground font-normal">(Select the correct one)</span>}
                          </Label>
                          {question.answers.map((answer, aIndex) => (
                            <div key={answer.id} className="flex items-center gap-2 sm:gap-3">
                              <button
                                type="button"
                                onClick={() => setCorrectAnswer(qIndex, aIndex)}
                                className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  answer.isCorrect
                                    ? 'border-green-500 bg-green-500 text-white'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                {answer.isCorrect && <Check className="h-3 w-3 sm:h-4 sm:w-4" />}
                              </button>
                              <Input
                                value={answer.answerText}
                                onChange={(e) => {
                                  const newQuestions = [...questions];
                                  newQuestions[qIndex].answers[aIndex].answerText = e.target.value;
                                  setQuestions(newQuestions);
                                }}
                                placeholder={question.questionType === 'true_false' 
                                  ? (aIndex === 0 ? 'True' : 'False')
                                  : `Answer ${aIndex + 1}`
                                }
                                className={`text-sm sm:text-base h-9 sm:h-10 flex-1 ${
                                  answer.isCorrect 
                                    ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20 focus:ring-green-500' 
                                    : ''
                                }`}
                              />
                              {question.answers.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAnswer(qIndex, aIndex)}
                                  className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
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
                              className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                            >
                              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                              Add Answer Option
                            </Button>
                          )}
                          {!hasCorrectAnswer && (
                            <p className="text-xs text-red-500 mt-1">Please select the correct answer</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </form>
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t mt-4 px-4 sm:px-0">
          <div className="flex gap-2 order-2 sm:order-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none h-10 sm:h-11 text-sm sm:text-base"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="flex-1 sm:flex-none h-10 sm:h-11 text-sm sm:text-base"
            >
              <ChevronLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </Button>
          </div>

          {currentStep < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              className="min-w-[120px] sm:min-w-[140px] h-10 sm:h-11 text-sm sm:text-base order-1 sm:order-2"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1 sm:ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || cost === 0 || (shouldValidateBalance && userBalance !== null && userBalance < cost)}
              className="min-w-full sm:min-w-[200px] h-10 sm:h-11 text-sm sm:text-base order-1 sm:order-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Creating...</span>
                  <span className="sm:hidden">Creating</span>
                </>
              ) : (
                <>
                  {isEditMode ? 'Update Quiz' : 'Create Quiz'}
                  {!isEditMode && (
                    <span className="ml-2 text-xs opacity-90 hidden sm:inline">
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
