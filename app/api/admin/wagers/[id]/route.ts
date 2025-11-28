import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * PATCH /api/admin/wagers/[id]
 * Update a wager (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { sanitizeUUID, sanitizeString } = await import('@/lib/security/input-sanitizer');
    const sanitizedId = sanitizeUUID(id) || sanitizeString(id, 20);
    
    if (!sanitizedId) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid wager ID');
    }
    
    const body = await request.json();

    // Get wager first
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id, status')
      .or(`id.eq.${sanitizedId},short_id.eq.${sanitizedId}`)
      .single();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    // Don't allow editing settled/resolved wagers
    if (wager.status === 'SETTLED' || wager.status === 'RESOLVED') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot edit settled or resolved wagers');
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

    if (body.amount !== undefined) {
      if (typeof body.amount !== 'number' || body.amount <= 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Amount must be a positive number');
      }
      updateData.amount = body.amount;
    }

    if (body.sideA !== undefined) {
      if (typeof body.sideA !== 'string' || !body.sideA.trim()) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Side A is required');
      }
      updateData.side_a = body.sideA.trim();
    }

    if (body.sideB !== undefined) {
      if (typeof body.sideB !== 'string' || !body.sideB.trim()) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Side B is required');
      }
      updateData.side_b = body.sideB.trim();
    }

    if (body.deadline !== undefined) {
      if (!new Date(body.deadline)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid deadline');
      }
      updateData.deadline = new Date(body.deadline).toISOString();
    }

    if (body.category !== undefined) {
      updateData.category = body.category || null;
    }

    if (body.currency !== undefined) {
      updateData.currency = body.currency;
    }

    if (body.isPublic !== undefined) {
      updateData.is_public = body.isPublic;
    }

    if (body.isSystemGenerated !== undefined) {
      updateData.is_system_generated = body.isSystemGenerated;
    }

    if (body.status !== undefined) {
      // Only allow status changes to valid states
      const validStatuses = ['OPEN', 'RESOLVED', 'SETTLED', 'REFUNDED'];
      if (!validStatuses.includes(body.status)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid status');
      }
      updateData.status = body.status;
    }

    // Update wager
    const { data: updatedWager, error: updateError } = await supabase
      .from('wagers')
      .update(updateData)
      .eq('id', wager.id)
      .select()
      .single();

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to update wager: ${updateError.message}`);
    }

    return successResponseNext({ wager: updatedWager });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/admin/wagers/[id]
 * Delete a wager (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { sanitizeUUID, sanitizeString } = await import('@/lib/security/input-sanitizer');
    const sanitizedId = sanitizeUUID(id) || sanitizeString(id, 20);
    
    if (!sanitizedId) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid wager ID');
    }

    // Get wager first
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id, status')
      .or(`id.eq.${sanitizedId},short_id.eq.${sanitizedId}`)
      .single();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    // Check if wager has entries
    const { data: entries, error: entriesError } = await supabase
      .from('wager_entries')
      .select('id')
      .eq('wager_id', wager.id)
      .limit(1);

    if (entriesError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to check wager entries');
    }

    if (entries && entries.length > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Cannot delete wager with existing entries. Please refund or settle the wager first.'
      );
    }

    // Delete wager
    const { error: deleteError } = await supabase
      .from('wagers')
      .delete()
      .eq('id', wager.id);

    if (deleteError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to delete wager: ${deleteError.message}`);
    }

    return successResponseNext({ message: 'Wager deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

