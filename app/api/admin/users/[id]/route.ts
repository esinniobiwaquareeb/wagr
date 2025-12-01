import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * DELETE /api/admin/users/[id]
 * Soft delete a user account (only if no activities)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const { id } = await params;

    if (!id) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'User ID is required');
    }

    // Check if user exists and is not already deleted
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_admin, deleted_at')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      throw new AppError(ErrorCode.NOT_FOUND, 'User not found');
    }

    // Check if already deleted
    if (profile.deleted_at) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'User account is already deleted');
    }

    // Prevent deleting admin accounts
    if (profile.is_admin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Cannot delete admin accounts');
    }

    // Check for user activities
    // Activities include: wagers created, wager entries, transactions, quizzes created, quiz participations, withdrawals, bill payments
    const userId = profile.id;

    const [
      wagersResult,
      entriesResult,
      transactionsResult,
      quizzesResult,
      quizParticipationsResult,
      withdrawalsResult,
      billPaymentsResult,
    ] = await Promise.all([
      supabase
        .from('wagers')
        .select('id')
        .eq('creator_id', userId)
        .limit(1),
      supabase
        .from('wager_entries')
        .select('id')
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('quizzes')
        .select('id')
        .eq('creator_id', userId)
        .limit(1),
      supabase
        .from('quiz_participants')
        .select('id')
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('withdrawals')
        .select('id')
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('bill_payments')
        .select('id')
        .eq('user_id', userId)
        .limit(1),
    ]);

    // Check if user has any activities
    const hasActivities = 
      (wagersResult.data && wagersResult.data.length > 0) ||
      (entriesResult.data && entriesResult.data.length > 0) ||
      (transactionsResult.data && transactionsResult.data.length > 0) ||
      (quizzesResult.data && quizzesResult.data.length > 0) ||
      (quizParticipationsResult.data && quizParticipationsResult.data.length > 0) ||
      (withdrawalsResult.data && withdrawalsResult.data.length > 0) ||
      (billPaymentsResult.data && billPaymentsResult.data.length > 0);

    if (hasActivities) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Cannot delete user account. User has activities (wagers, transactions, quizzes, etc.). Accounts with activities cannot be deleted.'
      );
    }

    // Soft delete: set deleted_at timestamp
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to delete user account');
    }

    // Delete all active sessions to prevent login
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId);

    return successResponseNext({
      success: true,
      message: 'User account deleted successfully',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

