import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { getOrFetchWagerDetail, invalidateWagerCaches } from '@/lib/redis/wagers';

/**
 * GET /api/wagers/[id]
 * Get a single wager by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { sanitizeUUID, sanitizeString } = await import('@/lib/security/input-sanitizer');
    const sanitizedId = sanitizeUUID(id) || sanitizeString(id, 20); // Allow short_id (6 chars) or UUID
    
    if (!sanitizedId) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid wager ID');
    }
    
    const wagerId = sanitizedId;

    // Use Redis caching with cache-aside pattern
    const wagerData = await getOrFetchWagerDetail(wagerId, async () => {
      // Try to find by short_id first, then by id
      // Use parameterized queries - Supabase handles escaping
      const { data: wager, error } = await supabase
        .from('wagers')
        .select('*, profiles:creator_id(username, avatar_url)')
        .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
        .single();

      if (error || !wager) {
        throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
      }

      // Get entry counts
      const { data: entries } = await supabase
        .from('wager_entries')
        .select('side, amount, user_id, profiles:user_id(username, avatar_url)')
        .eq('wager_id', wager.id);

      const entryCounts = {
        sideA: 0,
        sideB: 0,
        total: 0,
      };

      const sideAEntries: any[] = [];
      const sideBEntries: any[] = [];

      entries?.forEach(entry => {
        const amount = parseFloat(entry.amount);
        entryCounts.total += amount;
        if (entry.side === 'a') {
          entryCounts.sideA += amount;
          sideAEntries.push(entry);
        } else {
          entryCounts.sideB += amount;
          sideBEntries.push(entry);
        }
      });

      return {
        ...wager,
        entryCounts,
        entries: {
          sideA: sideAEntries,
          sideB: sideBEntries,
        },
      };
    });

    return successResponseNext({
      wager: wagerData,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/wagers/[id]
 * Delete a wager (only if creator and no participants)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { sanitizeUUID, sanitizeString } = await import('@/lib/security/input-sanitizer');
    const sanitizedId = sanitizeUUID(id) || sanitizeString(id, 20);
    
    if (!sanitizedId) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid wager ID');
    }
    
    const wagerId = sanitizedId;

    // Get wager
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id, creator_id, status, deadline')
      .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
      .single();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    // Check if user is creator
    if (wager.creator_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only the creator can delete this wager');
    }

    // Check if wager is already resolved
    if (wager.status !== 'OPEN') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete a resolved wager');
    }

    // Check if deadline has elapsed
    if (wager.deadline) {
      const deadlineDate = new Date(wager.deadline);
      const now = new Date();
      if (deadlineDate.getTime() <= now.getTime()) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete an expired wager. It must be resolved instead.');
      }
    }

    // Check if there are any participants (other than creator)
    const { data: entries, error: entriesError } = await supabase
      .from('wager_entries')
      .select('user_id')
      .eq('wager_id', wagerId)
      .neq('user_id', user.id);

    if (entriesError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to check participants');
    }

    if (entries && entries.length > 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete wager with participants');
    }

    // Get wager amount for refund - use the actual UUID from the wager we fetched
    const actualWagerId = wager.id; // Use the UUID from the fetched wager, not the sanitized input

    const { data: fullWager } = await supabase
      .from('wagers')
      .select('amount')
      .eq('id', actualWagerId)
      .single();

    // Refund creator's entry
    if (fullWager) {
      await supabase.rpc('increment_balance', {
        user_id: user.id,
        amt: fullWager.amount,
      });

      // Record refund transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'wager_refund',
        amount: fullWager.amount,
        reference: actualWagerId,
        description: 'Wager deleted - refund',
      });
    }

    // Delete wager activities first to prevent trigger from trying to insert after wager is deleted
    await supabase
      .from('wager_activities')
      .delete()
      .eq('wager_id', actualWagerId);

    // Delete wager comments
    await supabase
      .from('wager_comments')
      .delete()
      .eq('wager_id', actualWagerId);

    // Delete wager entries (this will trigger create_leave_activity, but wager still exists)
    const { error: entriesDeleteError } = await supabase
      .from('wager_entries')
      .delete()
      .eq('wager_id', actualWagerId);

    if (entriesDeleteError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to delete wager entries');
    }

    // Delete wager (entries already deleted, activities already deleted, so no trigger issues)
    const { error: deleteError } = await supabase
      .from('wagers')
      .delete()
      .eq('id', actualWagerId);

    if (deleteError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to delete wager');
    }

    // Invalidate wager caches after deletion
    await invalidateWagerCaches(wagerId).catch((err) => {
      console.error('Failed to invalidate wager caches:', err);
      // Don't fail the request if cache invalidation fails
    });

    return successResponseNext({ message: 'Wager deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

