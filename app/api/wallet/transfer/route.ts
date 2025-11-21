import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/wallet/transfer
 * Transfer funds from one user to another by username
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit({
      identifier: clientIP,
      endpoint: '/api/wallet/transfer',
      limit: 20, // 20 transfers per hour
      window: 3600, // 1 hour
    });

    if (!rateLimit.allowed) {
      return errorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many transfer requests. Please try again later.',
        {
          retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
        },
        429
      );
    }

    const user = await requireAuth();
    const supabase = await createClient();
    const supabaseAdmin = createServiceRoleClient(); // Use service role for balance updates

    const body = await request.json();
    const { username, amount, description } = body;

    // Validate input
    if (!username || typeof username !== 'string' || !username.trim()) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Username is required');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Amount must be a positive number');
    }

    // Round to 2 decimal places to avoid floating point precision issues
    const roundedAmount = Math.round(amount * 100) / 100;

    // Minimum transfer amount (₦1)
    if (roundedAmount < 1) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Minimum transfer amount is ₦1');
    }

    // Prevent self-transfer
    const trimmedUsername = username.trim().replace('@', '');
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (senderProfile?.username?.toLowerCase() === trimmedUsername.toLowerCase()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'You cannot transfer funds to yourself');
    }

    // Find recipient by username
    const { data: recipientProfile, error: recipientError } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('username', trimmedUsername)
      .single();

    if (recipientError || !recipientProfile) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'User not found. Please check the username and try again.');
    }

    // Check sender balance
    const { data: senderBalanceData, error: balanceError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (balanceError || !senderBalanceData) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch your balance');
    }

    const senderBalance = parseFloat(senderBalanceData.balance || 0);
    if (senderBalance < roundedAmount) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance');
    }

    // Generate unique reference for the transfer
    const reference = `transfer_${user.id}_${recipientProfile.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Use a transaction-like approach: create transaction records first, then update balances
    // This ensures atomicity as much as possible

    // Create sender transaction (debit)
    const { data: senderTransaction, error: senderTxError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'transfer_out',
        amount: -roundedAmount,
        reference: reference,
        description: description?.trim() || `Transfer to @${recipientProfile.username}`,
      })
      .select()
      .single();

    if (senderTxError || !senderTransaction) {
      logError(new Error(`Failed to create sender transaction: ${senderTxError?.message}`), {
        senderTxError,
        userId: user.id,
        amount: roundedAmount,
        reference,
      });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to process transfer');
    }

    // Create recipient transaction (credit)
    const { data: recipientTransaction, error: recipientTxError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: recipientProfile.id,
        type: 'transfer_in',
        amount: roundedAmount,
        reference: reference,
        description: description?.trim() || `Transfer from @${senderProfile?.username || 'user'}`,
      })
      .select()
      .single();

    if (recipientTxError || !recipientTransaction) {
      // If recipient transaction fails, we should ideally rollback sender transaction
      // But since we can't do true transactions, we'll log it for manual intervention
      logError(new Error(`Failed to create recipient transaction: ${recipientTxError?.message}`), {
        recipientTxError,
        recipientId: recipientProfile.id,
        amount: roundedAmount,
        reference,
        senderTransactionId: senderTransaction.id,
      });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to process transfer');
    }

    // Update sender balance (debit)
    const { error: senderBalanceError } = await supabaseAdmin.rpc('increment_balance', {
      user_id: user.id,
      amt: -roundedAmount,
    });

    if (senderBalanceError) {
      logError(new Error(`Failed to update sender balance: ${senderBalanceError.message}`), {
        senderBalanceError,
        userId: user.id,
        amount: roundedAmount,
        reference,
        senderTransactionId: senderTransaction.id,
        recipientTransactionId: recipientTransaction.id,
      });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to process transfer');
    }

    // Update recipient balance (credit)
    const { error: recipientBalanceError } = await supabaseAdmin.rpc('increment_balance', {
      user_id: recipientProfile.id,
      amt: roundedAmount,
    });

    if (recipientBalanceError) {
      // Critical error: sender balance was deducted but recipient balance wasn't credited
      // Log for manual intervention
      logError(new Error(`Failed to update recipient balance: ${recipientBalanceError.message}`), {
        recipientBalanceError,
        recipientId: recipientProfile.id,
        amount: roundedAmount,
        reference,
        senderTransactionId: senderTransaction.id,
        recipientTransactionId: recipientTransaction.id,
      });
      // Try to refund sender
      await supabaseAdmin.rpc('increment_balance', {
        user_id: user.id,
        amt: roundedAmount,
      });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Transfer failed. Your balance has been refunded.');
    }

    // Send notification to recipient (optional, but good UX)
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: recipientProfile.id,
        type: 'balance_update',
        title: 'Funds Received',
        message: `You received ${roundedAmount.toLocaleString()} from @${senderProfile?.username || 'a user'}`,
        link: '/wallet',
        metadata: {
          amount: roundedAmount,
          sender_username: senderProfile?.username,
          reference,
        },
      });
    } catch (notificationError) {
      // Don't fail the transfer if notification fails
      logError(new Error(`Failed to send notification: ${notificationError}`), {
        recipientId: recipientProfile.id,
      });
    }

    return successResponseNext({
      message: 'Transfer successful',
      transfer: {
        reference,
        amount: roundedAmount,
        recipient: {
          id: recipientProfile.id,
          username: recipientProfile.username,
        },
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

