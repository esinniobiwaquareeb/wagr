import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams, getPaginationMeta } from '@/lib/api-response';
import { getOrFetchWagerList, invalidateWagerLists } from '@/lib/redis/wagers';

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

    // Use Redis caching with cache-aside pattern
    const result = await getOrFetchWagerList(
      { page, limit, status, category, search, currency },
      async () => {
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
          // Sanitize search input to prevent injection
          const { sanitizeSearchInput } = await import('@/lib/security/input-sanitizer');
          const sanitizedSearch = sanitizeSearchInput(search);
          if (sanitizedSearch) {
            // Use parameterized query - Supabase handles escaping
            query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
          }
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

        return {
          wagers: wagers || [],
          pagination: getPaginationMeta(page, limit, count || 0),
        };
      }
    );

    return successResponseNext(
      { wagers: result.wagers },
      result.pagination
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

    // Get wager limits from settings
    const { getWagerLimits } = await import('@/lib/settings');
    const { minAmount, maxAmount, minDeadline, maxDeadline } = await getWagerLimits();
    
    if (amount < minAmount) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Minimum wager amount is ₦${minAmount}`);
    }
    
    if (amount > maxAmount) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Maximum wager amount is ₦${maxAmount}`);
    }

    if (!deadline || !new Date(deadline)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Deadline is required');
    }

    // Validate deadline range
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDeadline < minDeadline) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Deadline must be at least ${minDeadline} day(s) from now`);
    }
    
    if (daysUntilDeadline > maxDeadline) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Deadline cannot be more than ${maxDeadline} days from now`);
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

    // Check for similar/duplicate wager titles
    const { areTitlesSimilar } = await import('@/lib/wager-title-matcher');
    const trimmedTitle = title.trim();
    const { data: existingWagers } = await supabase
      .from('wagers')
      .select('id, title, side_a, side_b, amount, short_id, status')
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(50);

    if (existingWagers && existingWagers.length > 0) {
      const similarWagers = existingWagers.filter(wager => 
        areTitlesSimilar(trimmedTitle, wager.title)
      );

      if (similarWagers.length > 0) {
        // Refund balance before throwing error
        await supabase.rpc('increment_balance', {
          user_id: user.id,
          amt: amount,
        });

        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'A similar wager already exists. Please use a different title or join the existing wager.',
          {
            similarWagers: similarWagers.map(w => ({
              id: w.id,
              shortId: w.short_id,
              title: w.title,
              sideA: w.side_a,
              sideB: w.side_b,
              amount: w.amount,
            })),
          }
        );
      }
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
        fee_percentage: await (await import('@/lib/settings')).getWagerPlatformFee(),
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

    // Invalidate wager caches after creation
    await invalidateWagerLists().catch((err) => {
      console.error('Failed to invalidate wager caches:', err);
      // Don't fail the request if cache invalidation fails
    });

    return successResponseNext({ wager }, undefined, 201);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

