import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/wagers/[id]
 * Get a single wager by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const wagerId = params.id;

    // Try to find by short_id first, then by id
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

    return successResponseNext({
      wager: {
        ...wager,
        entryCounts,
        entries: {
          sideA: sideAEntries,
          sideB: sideBEntries,
        },
      },
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
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const wagerId = params.id;

    // Get wager
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('creator_id, status')
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

    // Get wager amount for refund
    const { data: fullWager } = await supabase
      .from('wagers')
      .select('amount')
      .eq('id', wagerId)
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
        reference: wagerId,
        description: 'Wager deleted - refund',
      });
    }

    // Delete wager (cascade will delete entries)
    const { error: deleteError } = await supabase
      .from('wagers')
      .delete()
      .eq('id', wagerId);

    if (deleteError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to delete wager');
    }

    return successResponseNext({ message: 'Wager deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

