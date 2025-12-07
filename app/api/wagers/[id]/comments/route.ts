import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * POST /api/wagers/[id]/comments
 * Create a comment or reply on a wager
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { content, parent_id } = body;
    const supabase = await createClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const wagerId = validateIDParam(id, 'wager ID');

    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Comment content is required');
    }

    // Verify wager exists (handle both UUID and short_id)
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id')
      .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
      .maybeSingle();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    // Use the actual UUID from the database, not the potentially short_id from params
    const actualWagerId = wager.id;

    // If parent_id is provided, verify it exists and belongs to the same wager
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from('wager_comments')
        .select('id, wager_id')
        .eq('id', parent_id)
        .maybeSingle();

      if (parentError || !parentComment) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Parent comment not found');
      }

      if (parentComment.wager_id !== wager.id) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Parent comment does not belong to this wager');
      }
    }

    // Create comment
    const { data: comment, error: insertError } = await supabase
      .from('wager_comments')
      .insert({
        wager_id: actualWagerId,
        user_id: user.id,
        content: content.trim(),
        parent_id: parent_id || null,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      logError(insertError as Error);
      
      // Check for foreign key constraint errors
      if (insertError.code === '23503' || insertError.message?.includes('foreign key')) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          'Database configuration error. Please contact support.',
          500
        );
      }

      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to create comment');
    }

    return successResponseNext({
      comment,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

