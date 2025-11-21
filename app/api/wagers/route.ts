import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams, getPaginationMeta } from '@/lib/api-response';

/**
 * GET /api/wagers
 * List wagers with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { page, limit } = getPaginationParams(request);
    const offset = (page - 1) * limit;

    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // OPEN, RESOLVED, REFUNDED
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const currency = url.searchParams.get('currency');

    // Build query
    let query = supabase
      .from('wagers')
      .select('*, profiles:creator_id(username, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (currency) {
      query = query.eq('currency', currency);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: wagers, error, count } = await query;

    if (error) {
      logError(new Error(`Failed to fetch wagers: ${error.message}`), {
        error,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new AppError(
        ErrorCode.DATABASE_ERROR, 
        `Failed to fetch wagers: ${error.message}`,
        { databaseError: error }
      );
    }

    // Get entry counts for each wager
    const wagerIds = wagers?.map(w => w.id) || [];
    if (wagerIds.length > 0) {
      const { data: entries } = await supabase
        .from('wager_entries')
        .select('wager_id, side, amount')
        .in('wager_id', wagerIds);

      const entryCounts = entries?.reduce((acc, entry) => {
        if (!acc[entry.wager_id]) {
          acc[entry.wager_id] = { sideA: 0, sideB: 0, total: 0 };
        }
        if (entry.side === 'a') {
          acc[entry.wager_id].sideA += parseFloat(entry.amount);
        } else {
          acc[entry.wager_id].sideB += parseFloat(entry.amount);
        }
        acc[entry.wager_id].total += parseFloat(entry.amount);
        return acc;
      }, {} as Record<string, { sideA: number; sideB: number; total: number }>) || {};

      // Add entry counts to wagers
      wagers?.forEach(wager => {
        (wager as any).entryCounts = entryCounts[wager.id] || { sideA: 0, sideB: 0, total: 0 };
      });
    }

    return successResponseNext(
      { wagers: wagers || [] },
      getPaginationMeta(page, limit, count || 0)
    );
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * POST /api/wagers
 * Create a new wager
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const supabase = await createClient();

    const {
      title,
      description,
      amount,
      sideA,
      sideB,
      deadline,
      category,
      currency = 'NGN',
      isPublic = true,
      creatorSide = 'a',
    } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Title must be at least 5 characters');
    }

    if (!sideA || !sideB || typeof sideA !== 'string' || typeof sideB !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Both sides are required');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Amount must be a positive number');
    }

    if (!deadline || !new Date(deadline)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Deadline is required');
    }

    // Check user balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.balance || 0) < amount) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance');
    }

    // Deduct balance for wager creation
    const { error: balanceError } = await supabase.rpc('increment_balance', {
      user_id: user.id,
      amt: -amount,
    });

    if (balanceError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to deduct balance');
    }

    // Record transaction
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'wager_create',
      amount: -amount,
      description: `Created wager: "${title.trim()}"`,
    });

    if (txError) {
      // Log the actual error for debugging
      logError(new Error(`Failed to record transaction: ${txError.message}`), {
        txError,
        userId: user.id,
      });
      
      // Refund balance if transaction record fails
      await supabase.rpc('increment_balance', {
        user_id: user.id,
        amt: amount,
      });
      throw new AppError(
        ErrorCode.DATABASE_ERROR, 
        `Failed to record transaction: ${txError.message}`,
        { databaseError: txError }
      );
    }

    // Create wager
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .insert({
        creator_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        amount,
        side_a: sideA.trim(),
        side_b: sideB.trim(),
        deadline: new Date(deadline).toISOString(),
        category: category || null,
        currency,
        is_public: isPublic,
        status: 'OPEN',
        fee_percentage: 0.05,
      })
      .select()
      .single();

    if (wagerError || !wager) {
      // Log the actual error for debugging
      logError(new Error(`Failed to create wager: ${wagerError?.message || 'Unknown error'}`), {
        wagerError,
        userId: user.id,
        wagerData: {
          creator_id: user.id,
          title: title.trim(),
          amount,
        }
      });
      
      // Refund balance if wager creation fails
      await supabase.rpc('increment_balance', {
        user_id: user.id,
        amt: amount,
      });
      throw new AppError(
        ErrorCode.DATABASE_ERROR, 
        `Failed to create wager: ${wagerError?.message || 'Unknown error'}`,
        { databaseError: wagerError }
      );
    }

    // Update transaction reference
    await supabase
      .from('transactions')
      .update({ reference: wager.id })
      .eq('user_id', user.id)
      .eq('type', 'wager_create')
      .order('created_at', { ascending: false })
      .limit(1);

    // Automatically join creator to their chosen side
    const { error: entryError } = await supabase.from('wager_entries').insert({
      wager_id: wager.id,
      user_id: user.id,
      side: creatorSide,
      amount,
    });

    if (entryError) {
      // Log the actual error for debugging
      logError(new Error(`Failed to create wager entry: ${entryError.message}`), {
        entryError,
        userId: user.id,
        wagerId: wager.id,
      });
      
      // Refund if entry creation fails
      await supabase.rpc('increment_balance', {
        user_id: user.id,
        amt: amount,
      });
      throw new AppError(
        ErrorCode.DATABASE_ERROR, 
        `Failed to join wager: ${entryError.message}`,
        { databaseError: entryError }
      );
    }

    // Record entry transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'wager_join',
      amount: -amount,
      reference: wager.id,
      description: `Wager Entry: "${title.trim()}" - Joined ${creatorSide === 'a' ? sideA : sideB}`,
    });

    return successResponseNext({ wager }, undefined, 201);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

