import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * POST /api/admin/wagers/[id]/resolve
 * Set winning side for a wager (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const wagerId = validateIDParam(id, 'wager ID');
    const body = await request.json();
    const { winningSide } = body;

    if (!winningSide || (winningSide !== 'a' && winningSide !== 'b')) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid winning side. Must be "a" or "b"');
    }

    // Get wager
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id, status')
      .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
      .maybeSingle();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    // Update wager with winning side (keep status as OPEN so settlement function can process it)
    const { error: updateError } = await supabase
      .from('wagers')
      .update({ 
        winning_side: winningSide,
        status: 'OPEN' // Keep as OPEN so settlement function can process it
      })
      .eq('id', wager.id);

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to update wager');
    }

    return successResponseNext({
      message: 'Winning side set. The wager will be automatically settled by the system when the deadline passes.',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

