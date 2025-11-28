import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, errorResponse } from '@/lib/api-response';
import { formatCurrency } from '@/lib/currency';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const { getSecuritySettings } = await import('@/lib/settings');
    const { apiRateLimit, apiRateWindow } = await getSecuritySettings();
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit({
      identifier: clientIP,
      endpoint: '/api/payments/withdraw',
      limit: Math.min(apiRateLimit, 10), // Cap at 10 for withdrawals
      window: apiRateWindow,
    });

    if (!rateLimit.allowed) {
      return errorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many withdrawal requests. Please try again later.',
        {
          retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
        },
        429
      );
    }

    const body = await request.json();
    const { amount, accountNumber, bankCode, accountName } = body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid amount');
    }

    // Get minimum withdrawal amount from settings
    const { getPaymentLimits } = await import('@/lib/settings');
    const { minWithdrawal } = await getPaymentLimits();
    
    if (amount < minWithdrawal) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Minimum withdrawal amount is ${formatCurrency(minWithdrawal, 'NGN')}`);
    }

    if (!accountNumber || !bankCode || !accountName) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Bank account details are required');
    }

    // Verify user is authenticated using custom auth
    const user = await requireAuth();
    const supabase = await createClient();

    // Check user balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch user balance');
    }

    if (profile.balance < amount) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance');
    }

    // Check withdrawal limits
    const { data: limitCheck, error: limitError } = await supabase
      .rpc('check_withdrawal_limits', {
        user_id_param: user.id,
        amount_param: amount,
      });

    if (limitError || !limitCheck || limitCheck.length === 0) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to check withdrawal limits');
    }

    const limitResult = limitCheck[0];
    if (!limitResult.allowed) {
      throw new AppError(ErrorCode.WITHDRAWAL_LIMIT_EXCEEDED, limitResult.reason || 'Withdrawal limit exceeded');
    }

    // Get Paystack secret key
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      logError(new Error('PAYSTACK_SECRET_KEY is not set'));
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Payment service not configured');
    }

    // Generate unique reference
    const reference = `withdraw_${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create withdrawal record
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount: amount,
        status: 'pending',
        bank_account: {
          account_number: accountNumber,
          bank_code: bankCode,
          account_name: accountName,
        },
        reference: reference,
      })
      .select()
      .single();

    if (withdrawalError) {
      logError(new Error(`Error creating withdrawal: ${withdrawalError.message}`));
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to create withdrawal request');
    }

    // Reserve the amount by deducting from balance
    // If withdrawal fails, we'll refund it
    const { error: balanceError } = await supabase.rpc('increment_balance', {
      user_id: user.id,
      amt: -amount, // Negative to deduct
    });

    if (balanceError) {
      // Rollback withdrawal creation
      await supabase
        .from('withdrawals')
        .delete()
        .eq('id', withdrawal.id);

      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to process withdrawal');
    }

    // Create pending transaction record
    await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'withdrawal',
        amount: -amount, // Negative for withdrawal
        reference: reference,
        description: `Withdrawal request: ₦${amount.toLocaleString()} to ${accountName}`,
      });

    // Process withdrawal with Paystack Transfer
    // First, create a transfer recipient
    const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      }),
    });

    const recipientData = await recipientResponse.json();

    if (!recipientResponse.ok || !recipientData.status) {
      // Refund the balance
      await supabase.rpc('increment_balance', {
        user_id: user.id,
        amt: amount,
      });

      // Update withdrawal status
      await supabase
        .from('withdrawals')
        .update({
          status: 'failed',
          failure_reason: recipientData.message || 'Failed to create transfer recipient',
        })
        .eq('id', withdrawal.id);

      // Extract the actual error message from Paystack response
      const paystackMessage = recipientData.message || recipientData.data?.message || 'Failed to process withdrawal';
      
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        paystackMessage,
        { paystackError: recipientData },
        recipientResponse.status || 500
      );
    }

    const recipientCode = recipientData.data.recipient_code;

    // Update withdrawal with recipient code
    await supabase
      .from('withdrawals')
      .update({
        recipient_code: recipientCode,
        status: 'processing',
      })
      .eq('id', withdrawal.id);

    // Initiate transfer
    const transferResponse = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance', // Use Paystack balance
        amount: Math.round(amount * 100), // Amount in kobo
        recipient: recipientCode,
        reference: reference,
        reason: `Withdrawal from wagr - ${reference}`,
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferResponse.ok || !transferData.status) {
      // Refund the balance
      await supabase.rpc('increment_balance', {
        user_id: user.id,
        amt: amount,
      });

      // Update withdrawal status
      await supabase
        .from('withdrawals')
        .update({
          status: 'failed',
          failure_reason: transferData.message || 'Transfer failed',
        })
        .eq('id', withdrawal.id);

      // Extract the actual error message from Paystack response
      const paystackMessage = transferData.message || transferData.data?.message || 'Failed to process withdrawal';
      
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        paystackMessage,
        { paystackError: transferData },
        transferResponse.status || 500
      );
    }

    const transferCode = transferData.data.transfer_code;

      // Update withdrawal with transfer code
      await supabase
        .from('withdrawals')
        .update({
          transfer_code: transferCode,
          status: 'processing',
        })
        .eq('id', withdrawal.id);

      // Update withdrawal usage in profile using RPC function
      const { error: usageError } = await supabase.rpc('increment_withdrawal_usage', {
        user_id_param: user.id,
        amount_param: amount,
      });

      if (usageError) {
        console.error('Error updating withdrawal usage:', usageError);
        // Don't fail the withdrawal, just log the error
      }

      // Note: Paystack will send a webhook when transfer is completed
      // We'll handle the final status update in the webhook handler

      return successResponseNext({
        message: 'Withdrawal request submitted successfully',
        withdrawal: {
          id: withdrawal.id,
          amount: amount,
          status: 'processing',
          reference: reference,
        },
      });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

