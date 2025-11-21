import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * POST /api/wagers/[id]/join
 * Join a wager on a specific side
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { side } = body; // 'a' or 'b'
    const supabase = await createClient();
    const wagerId = params.id;

    if (!side || (side !== 'a' && side !== 'b')) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Side must be "a" or "b"');
    }

    // Get wager
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id, title, amount, deadline, status, side_a, side_b')
      .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
      .single();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    // Check if wager is open
    if (wager.status !== 'OPEN') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Wager is not open');
    }

    // Check if deadline has passed
    if (wager.deadline && new Date(wager.deadline) < new Date()) {
      throw new AppError(ErrorCode.WAGER_EXPIRED, 'Wager deadline has passed');
    }

    // Check if user already joined
    const { data: existingEntry } = await supabase
      .from('wager_entries')
      .select('id')
      .eq('wager_id', wager.id)
      .eq('user_id', user.id)
      .single();

    if (existingEntry) {
      throw new AppError(ErrorCode.ALREADY_JOINED, 'You have already joined this wager');
    }

    // Check user balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.balance || 0) < wager.amount) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance');
    }

    // Deduct balance
    const { error: balanceError } = await supabase.rpc('increment_balance', {
      user_id: user.id,
      amt: -wager.amount,
    });

    if (balanceError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to deduct balance');
    }

    // Create entry
    const { error: entryError } = await supabase.from('wager_entries').insert({
      wager_id: wager.id,
      user_id: user.id,
      side,
      amount: wager.amount,
    });

    if (entryError) {
      // Refund if entry creation fails
      await supabase.rpc('increment_balance', {
        user_id: user.id,
        amt: wager.amount,
      });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to join wager');
    }

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'wager_join',
      amount: -wager.amount,
      reference: wager.id,
      description: `Wager Entry: "${wager.title || 'Wager'}" - Joined ${side === 'a' ? wager.side_a : wager.side_b}`,
    });

    // Get updated wager with entry counts
    const { data: updatedWager } = await supabase
      .from('wagers')
      .select('*, profiles:creator_id(username, avatar_url)')
      .eq('id', wager.id)
      .single();

    const { data: entries } = await supabase
      .from('wager_entries')
      .select('side, amount')
      .eq('wager_id', wager.id);

    const entryCounts = {
      sideA: 0,
      sideB: 0,
      total: 0,
    };

    entries?.forEach(entry => {
      const amount = parseFloat(entry.amount);
      entryCounts.total += amount;
      if (entry.side === 'a') {
        entryCounts.sideA += amount;
      } else {
        entryCounts.sideB += amount;
      }
    });

    return successResponseNext({
      wager: {
        ...updatedWager,
        entryCounts,
      },
      message: 'Successfully joined wager',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

