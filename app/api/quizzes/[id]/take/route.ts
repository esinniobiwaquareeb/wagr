import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * POST /api/quizzes/[id]/take
 * Start or submit quiz answers
 */
export async function POST(
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

    const { action, responses } = body; // action: 'start' | 'submit', responses: [{ questionId, answerId }]

    // Get quiz
    const { data: quiz, error: quizError } = await serviceSupabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .maybeSingle();

    if (quizError || !quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Prevent creator from taking their own quiz
    if (quiz.creator_id === user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'You cannot participate in your own quiz');
    }

    // Check if quiz is open or in progress
    if (!['open', 'in_progress'].includes(quiz.status)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Quiz is not available for taking');
    }

    // Check if user is a participant
    const { data: participant, error: participantError } = await serviceSupabase
      .from('quiz_participants')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (participantError || !participant) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'You are not invited to this quiz');
    }

    if (action === 'start') {
      if (participant.status === 'completed') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'You have already completed this quiz');
      }

      let participantRecord = participant;
      let startedAt = participant.started_at;

      if (participant.status === 'started') {
        // Allow resume without modifying status
        startedAt = participant.started_at || new Date().toISOString();
      } else {
        if (!['invited', 'accepted'].includes(participant.status)) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Quiz already started or completed');
        }

        startedAt = new Date().toISOString();

        const { data: updatedParticipant, error: updateError } = await serviceSupabase
          .from('quiz_participants')
          .update({
            status: 'started',
            started_at: startedAt,
          })
          .eq('id', participant.id)
          .select()
          .maybeSingle();

        if (updateError) {
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to start quiz');
        }

        participantRecord = updatedParticipant || participant;
      }

      // Get questions (randomized if enabled)
      let questionsQuery = serviceSupabase
        .from('quiz_questions')
        .select('*, quiz_answers (*)')
        .eq('quiz_id', quizId);

      if (quiz.randomize_questions) {
        questionsQuery = questionsQuery.order('order_index', { ascending: false }); // Will randomize in app
      } else {
        questionsQuery = questionsQuery.order('order_index', { ascending: true });
      }

      const { data: questions } = await questionsQuery;

      // Randomize answers if enabled
      let processedQuestions = questions || [];
      if (quiz.randomize_answers) {
        processedQuestions = processedQuestions.map(q => ({
          ...q,
          quiz_answers: (q.quiz_answers || []).sort(() => Math.random() - 0.5),
        }));
      }

      // Randomize questions if enabled
      if (quiz.randomize_questions) {
        processedQuestions = processedQuestions.sort(() => Math.random() - 0.5);
      }

      return successResponseNext({
        quiz,
        questions: processedQuestions,
        participant: {
          ...participantRecord,
          status: 'started',
          started_at: startedAt,
        },
      });
    }

    if (action === 'submit') {
      // Submit quiz answers
      if (participant.status !== 'started') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Quiz not started or already completed');
      }

      if (!responses || !Array.isArray(responses)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Responses array is required');
      }

      // Get all questions and correct answers
      const { data: questions } = await serviceSupabase
        .from('quiz_questions')
        .select('*, quiz_answers (*)')
        .eq('quiz_id', quizId);

      if (!questions || questions.length === 0) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'No questions found for this quiz');
      }

      // Process each response
      for (const response of responses) {
        const { questionId, answerId } = response;

        if (!questionId || !answerId) {
          continue; // Skip invalid responses
        }

        // Find the question and answer
        const question = questions.find(q => q.id === questionId);
        if (!question) continue;

        const answer = (question.quiz_answers || []).find((a: any) => a.id === answerId);
        if (!answer) continue;

        const isCorrect = answer.is_correct === true;
        const pointsEarned = isCorrect ? (question.points || 1) : 0;

        // Insert or update response
        const { error: responseError } = await serviceSupabase
          .from('quiz_responses')
          .upsert({
            participant_id: participant.id,
            question_id: questionId,
            answer_id: answerId,
            is_correct: isCorrect,
            points_earned: pointsEarned,
          }, {
            onConflict: 'participant_id,question_id',
          });

        if (responseError) {
          logError(new Error(`Failed to save response: ${responseError.message}`), { responseError });
        }
      }

      // Update participant status to completed
      const { error: completeError } = await serviceSupabase
        .from('quiz_participants')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', participant.id);

      if (completeError) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to complete quiz');
      }

      // Get updated participant with score
      const { data: updatedParticipant } = await serviceSupabase
        .from('quiz_participants')
        .select('*')
        .eq('id', participant.id)
        .maybeSingle();

      // Get all responses for results
      const { data: allResponses } = await serviceSupabase
        .from('quiz_responses')
        .select('*, quiz_questions (*, quiz_answers (*))')
        .eq('participant_id', participant.id);

      // If everyone has completed, mark the quiz as completed
      const { count: remainingParticipants, error: remainingError } = await serviceSupabase
        .from('quiz_participants')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .neq('status', 'completed');

      if (remainingError) {
        logError(new Error(`Failed to check participant statuses: ${remainingError.message}`), { remainingError });
      } else if (!remainingParticipants || remainingParticipants === 0) {
        const { error: markCompletedError } = await serviceSupabase
          .from('quizzes')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', quizId)
          .neq('status', 'settled');

        if (markCompletedError) {
          logError(new Error(`Failed to mark quiz as completed: ${markCompletedError.message}`), { markCompletedError });
        }
      }

      return successResponseNext({
        participant: updatedParticipant,
        responses: allResponses || [],
        showResults: quiz.show_results_immediately,
      });
    }

    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid action. Must be "start" or "submit"');
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

