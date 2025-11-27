import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams, getPaginationMeta } from '@/lib/api-response';

/**
 * GET /api/quizzes
 * List quizzes with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { page, limit } = getPaginationParams(request);
    const offset = (page - 1) * limit;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const creatorId = url.searchParams.get('creator_id');

    // Get all quiz IDs where user is a participant (invited, accepted, started, completed)
    const { data: userParticipants } = await serviceSupabase
      .from('quiz_participants')
      .select('quiz_id')
      .eq('user_id', user.id);

    const participantQuizIds = userParticipants?.map(p => p.quiz_id) || [];

    // Build query - only show quizzes user is invited to or created
    let query = serviceSupabase
      .from('quizzes')
      .select('*, profiles:creator_id(username, avatar_url)', { count: 'exact' })
      .or(`creator_id.eq.${user.id},id.in.(${participantQuizIds.length > 0 ? participantQuizIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: quizzes, error, count } = await query;

    if (error) {
      logError(new Error(`Failed to fetch quizzes: ${error.message}`), { error });
      throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to fetch quizzes: ${error.message}`);
    }

    // Get participant counts for each quiz
    const quizIds = quizzes?.map(q => q.id) || [];
    if (quizIds.length > 0) {
      const { data: participants } = await serviceSupabase
        .from('quiz_participants')
        .select('quiz_id, status')
        .in('quiz_id', quizIds);

      const participantCounts = new Map<string, { total: number; completed: number }>();
      
      participants?.forEach(p => {
        const current = participantCounts.get(p.quiz_id) || { total: 0, completed: 0 };
        current.total += 1;
        if (p.status === 'completed') {
          current.completed += 1;
        }
        participantCounts.set(p.quiz_id, current);
      });

      quizzes?.forEach(quiz => {
        const counts = participantCounts.get(quiz.id) || { total: 0, completed: 0 };
        (quiz as any).participantCounts = counts;
      });
    }

    return successResponseNext({
      quizzes: quizzes || [],
      pagination: getPaginationMeta(page, limit, count || 0),
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * POST /api/quizzes
 * Create a new quiz
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();

    const {
      title,
      description,
      entryFeePerQuestion,
      maxParticipants,
      totalQuestions,
      startDate,
      endDate,
      durationMinutes,
      randomizeQuestions = true,
      randomizeAnswers = true,
      showResultsImmediately = false,
      settlementMethod = 'proportional',
      topWinnersCount,
      questions, // Array of { questionText, questionType, points, answers: [{ answerText, isCorrect }] }
    } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Title must be at least 5 characters');
    }

    if (!entryFeePerQuestion || typeof entryFeePerQuestion !== 'number' || entryFeePerQuestion <= 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Entry fee per question must be a positive number');
    }

    if (!maxParticipants || typeof maxParticipants !== 'number' || maxParticipants <= 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Max participants must be a positive number');
    }

    if (!totalQuestions || typeof totalQuestions !== 'number' || totalQuestions <= 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Total questions must be a positive number');
    }

    // Get quiz limits from settings
    const { getQuizLimits } = await import('@/lib/settings');
    const { minParticipants, maxParticipants: maxParticipantsLimit, minQuestions, maxQuestions } = await getQuizLimits();
    
    if (maxParticipants < minParticipants) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Minimum participants is ${minParticipants}`);
    }
    
    if (maxParticipants > maxParticipantsLimit) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Maximum participants is ${maxParticipantsLimit}`);
    }
    
    if (totalQuestions < minQuestions) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Minimum questions is ${minQuestions}`);
    }
    
    if (totalQuestions > maxQuestions) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Maximum questions is ${maxQuestions}`);
    }

    if (!questions || !Array.isArray(questions) || questions.length !== totalQuestions) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Must provide exactly ${totalQuestions} questions`);
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

    // Get platform fee from settings
    const { getQuizPlatformFee } = await import('@/lib/settings');
    const platformFeePercentage = await getQuizPlatformFee();
    
    // Calculate costs separately
    const baseCost = entryFeePerQuestion * totalQuestions * maxParticipants; // What participants pay
    const platformFee = baseCost * platformFeePercentage; // Platform commission
    const totalCost = baseCost + platformFee; // What creator pays

    // Check user balance
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.balance || 0) < totalCost) {
      throw new AppError(
        ErrorCode.INSUFFICIENT_BALANCE,
        `Insufficient balance. Required: ${totalCost}, Available: ${profile?.balance || 0}`
      );
    }

    try {
      // Create quiz first (we'll reserve funds after)
      const { data: quiz, error: quizError } = await serviceSupabase
        .from('quizzes')
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: description?.trim() || null,
          entry_fee_per_question: entryFeePerQuestion,
          max_participants: maxParticipants,
          total_questions: totalQuestions,
          base_cost: baseCost,
          platform_fee: platformFee,
          total_cost: totalCost,
          platform_fee_percentage: platformFeePercentage,
          status: 'draft',
          start_date: startDate ? new Date(startDate).toISOString() : null,
          end_date: endDate ? new Date(endDate).toISOString() : null,
          duration_minutes: durationMinutes || null,
          randomize_questions: randomizeQuestions,
          randomize_answers: randomizeAnswers,
          show_results_immediately: showResultsImmediately,
          settlement_method: settlementMethod,
          top_winners_count: topWinnersCount || null,
        })
        .select()
        .single();

      if (quizError || !quiz) {
        throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to create quiz: ${quizError?.message || 'Unknown error'}`);
      }

      // Reserve funds after quiz creation
      const { error: reserveError } = await serviceSupabase.rpc('reserve_quiz_funds', {
        user_id_param: user.id,
        amount_param: totalCost,
        quiz_id_param: quiz.id,
      });

      if (reserveError) {
        logError(new Error(`Failed to reserve funds: ${reserveError.message}`), { reserveError });
        // Delete quiz if fund reservation fails
        await serviceSupabase.from('quizzes').delete().eq('id', quiz.id);
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to reserve funds');
      }

      // Create questions and answers
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        // Create question
        const { data: question, error: questionError } = await serviceSupabase
          .from('quiz_questions')
          .insert({
            quiz_id: quiz.id,
            question_text: q.questionText.trim(),
            question_type: q.questionType || 'multiple_choice',
            points: q.points || 1,
            order_index: i + 1,
          })
          .select()
          .single();

        if (questionError || !question) {
          logError(new Error(`Failed to create question ${i + 1}: ${questionError?.message}`), { questionError });
          // Continue - we'll handle cleanup if needed
          continue;
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
            logError(new Error(`Failed to create answer ${j + 1} for question ${i + 1}: ${answerError.message}`), { answerError });
          }
        }
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
        .eq('id', quiz.id)
        .single();

      return successResponseNext({
        quiz: completeQuiz,
      });
    } catch (error) {
      // Refund balance on any error
      await serviceSupabase.rpc('increment_balance', {
        user_id: user.id,
        amt: totalCost,
      });
      throw error;
    }
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

