import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * PATCH /api/wagers/[id]/comments/[commentId]
 * Update a comment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { content } = body;
    const supabase = await createClient();
    const { id, commentId } = await params;
    const wagerId = id;

    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Comment content is required');
    }

    // Verify wager exists (handle both UUID and short_id)
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id')
      .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
      .single();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    const actualWagerId = wager.id;

    // Verify comment exists and belongs to user
    const { data: comment, error: commentError } = await supabase
      .from('wager_comments')
      .select('id, wager_id, user_id')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Comment not found');
    }

    if (comment.wager_id !== actualWagerId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Comment does not belong to this wager');
    }

    if (comment.user_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'You can only edit your own comments');
    }

    // Update comment
    const { data: updatedComment, error: updateError } = await supabase
      .from('wager_comments')
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .select()
      .single();

    if (updateError) {
      logError(updateError as Error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to update comment');
    }

    return successResponseNext({
      comment: updatedComment,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/wagers/[id]/comments/[commentId]
 * Delete a comment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const { id, commentId } = await params;
    const wagerId = id;

    // Verify wager exists (handle both UUID and short_id)
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id')
      .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
      .single();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    const actualWagerId = wager.id;

    // Verify comment exists and belongs to user
    const { data: comment, error: commentError } = await supabase
      .from('wager_comments')
      .select('id, wager_id, user_id')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Comment not found');
    }

    if (comment.wager_id !== actualWagerId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Comment does not belong to this wager');
    }

    if (comment.user_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'You can only delete your own comments');
    }

    // Delete comment (replies will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('wager_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      logError(deleteError as Error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to delete comment');
    }

    return successResponseNext({
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

