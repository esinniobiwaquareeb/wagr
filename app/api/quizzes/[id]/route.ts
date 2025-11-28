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

    // Get participant counts
    const { data: participants } = await serviceSupabase
      .from('quiz_participants')
      .select('status, user_id, profiles:user_id(username, avatar_url, email)')
      .eq('quiz_id', quizId);

    const participantCounts = {
      total: participants?.length || 0,
      invited: participants?.filter(p => p.status === 'invited').length || 0,
      accepted: participants?.filter(p => p.status === 'accepted').length || 0,
      started: participants?.filter(p => p.status === 'started').length || 0,
      completed: participants?.filter(p => p.status === 'completed').length || 0,
    };

    return successResponseNext({
      quiz: {
        ...quiz,
        questions: questions || [],
        participantCounts,
        participants: participants || [],
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

    // Get quiz first
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, creator_id, status')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Check ownership
    if (quiz.creator_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only the creator can update this quiz');
    }

    // Only allow updates if status is 'draft'
    if (quiz.status !== 'draft') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Can only update quizzes in draft status');
    }

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

    return successResponseNext({ quiz: updatedQuiz });
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

