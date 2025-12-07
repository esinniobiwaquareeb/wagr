import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * POST /api/admin/wagers
 * Create a new wager (admin only - no balance deduction)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const body = await request.json();

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
      isSystemGenerated = false,
      creatorId = null,
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

    // Create wager (admin doesn't need to deduct balance)
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .insert({
        creator_id: creatorId || null,
        title: title.trim(),
        description: description?.trim() || null,
        amount,
        side_a: sideA.trim(),
        side_b: sideB.trim(),
        deadline: new Date(deadline).toISOString(),
        category: category || null,
        currency,
        is_public: isPublic,
        is_system_generated: isSystemGenerated,
        status: 'OPEN',
        fee_percentage: await (await import('@/lib/settings')).getWagerPlatformFee(),
      })
      .select()
      .maybeSingle();

    if (wagerError || !wager) {
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        `Failed to create wager: ${wagerError?.message || 'Unknown error'}`,
        { databaseError: wagerError }
      );
    }

    return successResponseNext({ wager }, undefined, 201);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

