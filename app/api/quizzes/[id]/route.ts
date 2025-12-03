import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/quizzes/[id]
 * Get a single quiz by ID with questions and answers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const quizId = validateIDParam(id, 'quiz ID', false); // Only UUID for quizzes

    // Get quiz with creator info
    const { data: quiz, error } = await serviceSupabase
      .from('quizzes')
      .select('*, profiles:creator_id(username, avatar_url, email)')
      .eq('id', quizId)
      .single();

    if (error || !quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Check if user is creator or invited participant
    const isCreator = quiz.creator_id === user.id;
    
    if (!isCreator) {
      // Check if user is a participant
      const { data: participant } = await serviceSupabase
        .from('quiz_participants')
        .select('id')
        .eq('quiz_id', quizId)
        .eq('user_id', user.id)
        .single();

      if (!participant) {
        throw new AppError(ErrorCode.FORBIDDEN, 'You are not invited to this quiz');
      }
    }

    // Get questions with answers
    const { data: questions } = await serviceSupabase
      .from('quiz_questions')
      .select('*, quiz_answers (*)')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });

    // Get participant counts and details
    const { data: participants } = await serviceSupabase
      .from('quiz_participants')
      .select('*, profiles:user_id(username, avatar_url, email)')
      .eq('quiz_id', quizId)
      .order('score', { ascending: false })
      .order('completed_at', { ascending: true });

    const participantCounts = {
      total: participants?.length || 0,
      invited: participants?.filter(p => p.status === 'invited').length || 0,
      accepted: participants?.filter(p => p.status === 'accepted').length || 0,
      started: participants?.filter(p => p.status === 'started').length || 0,
      completed: participants?.filter(p => p.status === 'completed').length || 0,
    };

    // Calculate percentage_score for all participants if not present
    const totalPossiblePoints = questions?.reduce((sum: number, q: any) => sum + (q.points || 1), 0) || quiz.total_questions || 1;
    const participantsWithScores = (participants || []).map((p: any) => ({
      ...p,
      percentage_score: p.percentage_score != null 
        ? p.percentage_score 
        : totalPossiblePoints > 0 && p.score != null
          ? ((p.score / totalPossiblePoints) * 100)
          : null,
    }));

    return successResponseNext({
      quiz: {
        ...quiz,
        questions: questions || [],
        participantCounts,
        participants: participantsWithScores,
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/quizzes/[id]
 * Update a quiz (only creator can update, and only if status is 'draft')
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const quizId = validateIDParam(id, 'quiz ID', false); // Only UUID for quizzes
    const body = await request.json();

    // Get quiz first with all necessary fields
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, creator_id, status, max_participants, entry_fee_per_question, total_questions, total_cost')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Check ownership
    if (quiz.creator_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only the creator can update this quiz');
    }

    // Allow updates if status is 'draft' or 'open' (but not 'completed', 'settled', or 'cancelled')
    if (!['draft', 'open'].includes(quiz.status)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Can only update quizzes in draft or open status');
    }

    // Get current participant count and check if any have started
    const { count: currentParticipantCount } = await serviceSupabase
      .from('quiz_participants')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId);

    const actualParticipantCount = currentParticipantCount || 0;

    // Check if any participants have started (for questions editing restriction)
    const { count: startedCount } = await serviceSupabase
      .from('quiz_participants')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .in('status', ['started', 'completed']);

    const hasStartedParticipants = (startedCount || 0) > 0;

    // Build update object
    const updateData: any = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length < 5) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Title must be at least 5 characters');
      }
      updateData.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    if (body.status !== undefined) {
      const validStatuses = ['draft', 'open'];
      if (!validStatuses.includes(body.status)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Status must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.status = body.status;
    }

    if (body.startDate !== undefined) {
      updateData.start_date = body.startDate ? new Date(body.startDate).toISOString() : null;
    }

    if (body.endDate !== undefined) {
      updateData.end_date = body.endDate ? new Date(body.endDate).toISOString() : null;
    }

    if (body.durationMinutes !== undefined) {
      updateData.duration_minutes = body.durationMinutes || null;
    }

    // Handle maxParticipants change intelligently
    if (body.maxParticipants !== undefined) {
      const newMaxParticipants = parseInt(body.maxParticipants);
      if (isNaN(newMaxParticipants) || newMaxParticipants <= 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Max participants must be a positive number');
      }

      // Get quiz limits from settings
      const { getQuizLimits } = await import('@/lib/settings');
      const { minParticipants, maxParticipants: maxParticipantsLimit } = await getQuizLimits();
      
      if (newMaxParticipants < minParticipants) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Minimum participants is ${minParticipants}`);
      }
      
      if (newMaxParticipants > maxParticipantsLimit) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Maximum participants is ${maxParticipantsLimit}`);
      }

      // Cannot reduce below current participant count
      if (newMaxParticipants < actualParticipantCount) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Cannot reduce max participants below current participant count (${actualParticipantCount})`);
      }

      const oldMaxParticipants = quiz.max_participants;
      const participantDifference = newMaxParticipants - oldMaxParticipants;

      if (participantDifference !== 0) {
        // Calculate cost difference
        const { getQuizPlatformFee } = await import('@/lib/settings');
        const platformFeePercentage = await getQuizPlatformFee();
        
        const entryFeePerQuestion = body.entryFeePerQuestion !== undefined 
          ? parseFloat(body.entryFeePerQuestion) 
          : quiz.entry_fee_per_question;
        const totalQuestions = body.totalQuestions !== undefined 
          ? parseInt(body.totalQuestions) 
          : quiz.total_questions;

        const baseCostDifference = entryFeePerQuestion * totalQuestions * participantDifference;
        const platformFeeDifference = baseCostDifference * platformFeePercentage;
        const totalCostDifference = baseCostDifference + platformFeeDifference;

        // Get user balance
        const { data: profile } = await serviceSupabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single();

        if (!profile) {
          throw new AppError(ErrorCode.DATABASE_ERROR, 'User profile not found');
        }

        if (participantDifference > 0) {
          // Increasing participants - deduct from balance
          if ((profile.balance || 0) < totalCostDifference) {
            throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, `Insufficient balance. Need ${totalCostDifference} to increase participants to ${newMaxParticipants}`);
          }

          // Deduct balance
          await serviceSupabase.rpc('increment_balance', {
            user_id: user.id,
            amt: -totalCostDifference,
          });

          // Record transaction
          await serviceSupabase.from('transactions').insert({
            user_id: user.id,
            type: 'quiz_update',
            amount: -totalCostDifference,
            reference: quizId,
            description: `Quiz update: Increased max participants from ${oldMaxParticipants} to ${newMaxParticipants}`,
          });

          // Update total_cost
          updateData.total_cost = (quiz.total_cost || 0) + totalCostDifference;
        } else {
          // Decreasing participants - refund to balance
          await serviceSupabase.rpc('increment_balance', {
            user_id: user.id,
            amt: Math.abs(totalCostDifference),
          });

          // Record transaction
          await serviceSupabase.from('transactions').insert({
            user_id: user.id,
            type: 'quiz_refund',
            amount: Math.abs(totalCostDifference),
            reference: quizId,
            description: `Quiz update: Decreased max participants from ${oldMaxParticipants} to ${newMaxParticipants}`,
          });

          // Update total_cost
          updateData.total_cost = Math.max(0, (quiz.total_cost || 0) - Math.abs(totalCostDifference));
        }
      }

      updateData.max_participants = newMaxParticipants;
    }

    // Handle entryFeePerQuestion or totalQuestions changes (recalculate total_cost)
    if (body.entryFeePerQuestion !== undefined || body.totalQuestions !== undefined) {
      const entryFeePerQuestion = body.entryFeePerQuestion !== undefined 
        ? parseFloat(body.entryFeePerQuestion) 
        : quiz.entry_fee_per_question;
      const totalQuestions = body.totalQuestions !== undefined 
        ? parseInt(body.totalQuestions) 
        : quiz.total_questions;
      const maxParticipants = body.maxParticipants !== undefined 
        ? parseInt(body.maxParticipants) 
        : quiz.max_participants;

      if (entryFeePerQuestion && totalQuestions && maxParticipants) {
        const { getQuizPlatformFee } = await import('@/lib/settings');
        const platformFeePercentage = await getQuizPlatformFee();
        
        const baseCost = entryFeePerQuestion * totalQuestions * maxParticipants;
        const platformFee = baseCost * platformFeePercentage;
        const newTotalCost = baseCost + platformFee;

        // Calculate difference
        const costDifference = newTotalCost - (quiz.total_cost || 0);

        if (costDifference !== 0) {
          // Get user balance
          const { data: profile } = await serviceSupabase
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

          if (!profile) {
            throw new AppError(ErrorCode.DATABASE_ERROR, 'User profile not found');
          }

          if (costDifference > 0) {
            // Cost increased - deduct from balance
            if ((profile.balance || 0) < costDifference) {
              throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, `Insufficient balance. Need ${costDifference} to update quiz costs`);
            }

            await serviceSupabase.rpc('increment_balance', {
              user_id: user.id,
              amt: -costDifference,
            });

            await serviceSupabase.from('transactions').insert({
              user_id: user.id,
              type: 'quiz_update',
              amount: -costDifference,
              reference: quizId,
              description: 'Quiz update: Cost increased due to fee or question count change',
            });
          } else {
            // Cost decreased - refund to balance
            await serviceSupabase.rpc('increment_balance', {
              user_id: user.id,
              amt: Math.abs(costDifference),
            });

            await serviceSupabase.from('transactions').insert({
              user_id: user.id,
              type: 'quiz_refund',
              amount: Math.abs(costDifference),
              reference: quizId,
              description: 'Quiz update: Cost decreased due to fee or question count change',
            });
          }

          updateData.total_cost = newTotalCost;
        }
      }
    }

    // Handle questions update (only if provided and quiz is in draft status)
    if (body.questions !== undefined && Array.isArray(body.questions)) {
      // Can only update questions if quiz is in draft and no participants have started
      if (quiz.status !== 'draft') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Questions can only be updated when quiz is in draft status');
      }

      if (hasStartedParticipants) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot update questions when participants have already started');
      }

      const questions = body.questions;
      const newTotalQuestions = body.totalQuestions !== undefined 
        ? parseInt(body.totalQuestions) 
        : quiz.total_questions;

      // Validate questions count matches totalQuestions
      if (questions.length !== newTotalQuestions) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Must provide exactly ${newTotalQuestions} questions`);
      }

      // Validate questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim().length === 0) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, `Question ${i + 1} text is required`);
        }
        if (!q.answers || !Array.isArray(q.answers) || q.answers.length < 2) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, `Question ${i + 1} must have at least 2 answers`);
        }
        const correctAnswers = q.answers.filter((a: any) => a.isCorrect === true);
        if (correctAnswers.length !== 1) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, `Question ${i + 1} must have exactly one correct answer`);
        }
      }

      // Delete existing questions and answers (cascade will handle answers)
      const { error: deleteQuestionsError } = await serviceSupabase
        .from('quiz_questions')
        .delete()
        .eq('quiz_id', quizId);

      if (deleteQuestionsError) {
        throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to delete existing questions: ${deleteQuestionsError.message}`);
      }

      // Create new questions and answers
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        // Create question
        const { data: question, error: questionError } = await serviceSupabase
          .from('quiz_questions')
          .insert({
            quiz_id: quizId,
            question_text: q.questionText.trim(),
            question_type: q.questionType || 'multiple_choice',
            points: q.points || 1,
            order_index: i + 1,
          })
          .select()
          .single();

        if (questionError || !question) {
          throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to create question ${i + 1}: ${questionError?.message || 'Unknown error'}`);
        }

        // Create answers
        for (let j = 0; j < q.answers.length; j++) {
          const answer = q.answers[j];
          const { error: answerError } = await serviceSupabase
            .from('quiz_answers')
            .insert({
              question_id: question.id,
              answer_text: answer.answerText.trim(),
              is_correct: answer.isCorrect === true,
              order_index: j + 1,
            });

          if (answerError) {
            throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to create answer ${j + 1} for question ${i + 1}: ${answerError.message}`);
          }
        }
      }

      // Update total_questions if changed
      if (body.totalQuestions !== undefined) {
        updateData.total_questions = newTotalQuestions;
      }
    }

    // Handle settlement method and related fields
    if (body.settlementMethod !== undefined) {
      const validMethods = ['proportional', 'top_winners', 'equal_split'];
      if (!validMethods.includes(body.settlementMethod)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Settlement method must be one of: ${validMethods.join(', ')}`);
      }
      updateData.settlement_method = body.settlementMethod;

      // Handle topWinnersCount
      if (body.settlementMethod === 'top_winners') {
        if (body.topWinnersCount !== undefined) {
          const topWinnersCount = parseInt(body.topWinnersCount);
          if (isNaN(topWinnersCount) || topWinnersCount < 1) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'Top winners count must be at least 1');
          }
          updateData.top_winners_count = topWinnersCount;
        }
      } else {
        updateData.top_winners_count = null;
      }
    }

    // Handle other quiz settings
    if (body.randomizeQuestions !== undefined) {
      updateData.randomize_questions = Boolean(body.randomizeQuestions);
    }
    if (body.randomizeAnswers !== undefined) {
      updateData.randomize_answers = Boolean(body.randomizeAnswers);
    }
    if (body.showResultsImmediately !== undefined) {
      updateData.show_results_immediately = Boolean(body.showResultsImmediately);
    }

    // Update quiz
    const { data: updatedQuiz, error: updateError } = await serviceSupabase
      .from('quizzes')
      .update(updateData)
      .eq('id', quizId)
      .select()
      .single();

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to update quiz: ${updateError.message}`);
    }

    // Fetch complete quiz with questions and answers
    const { data: completeQuiz } = await serviceSupabase
      .from('quizzes')
      .select(`
        *,
        quiz_questions (
          *,
          quiz_answers (*)
        )
      `)
      .eq('id', quizId)
      .single();

    return successResponseNext({ quiz: completeQuiz || updatedQuiz });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/quizzes/[id]
 * Delete a quiz (only creator can delete, and only if no participants have started)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const quizId = validateIDParam(id, 'quiz ID', false); // Only UUID for quizzes

    // Get quiz first
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, title, creator_id, status, total_cost')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Check ownership
    if (quiz.creator_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only the creator can delete this quiz');
    }

    // Check if any participants have started
    const { data: startedParticipants } = await supabase
      .from('quiz_participants')
      .select('id')
      .eq('quiz_id', quizId)
      .in('status', ['started', 'completed'])
      .limit(1);

    if (startedParticipants && startedParticipants.length > 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete quiz with participants who have started');
    }

    // Refund funds if quiz is not settled
    if (quiz.status !== 'settled') {
      await serviceSupabase.rpc('increment_balance', {
        user_id: user.id,
        amt: quiz.total_cost,
      });

      // Record refund transaction
      await serviceSupabase.from('transactions').insert({
        user_id: user.id,
        type: 'quiz_refund',
        amount: quiz.total_cost,
        reference: quizId,
        description: `Quiz deletion refund: "${quiz.title || 'Untitled Quiz'}"`,
      });
    }

    // Delete quiz (cascade will delete questions, answers, participants, responses)
    const { error: deleteError } = await serviceSupabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (deleteError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to delete quiz: ${deleteError.message}`);
    }

    return successResponseNext({ message: 'Quiz deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

