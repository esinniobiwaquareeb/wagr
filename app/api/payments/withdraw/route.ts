import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit({
      identifier: clientIP,
      endpoint: '/api/payments/withdraw',
      limit: 10, // 10 withdrawals per hour
      window: 3600, // 1 hour
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many withdrawal requests. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          },
        }
      );
    }

    const body = await request.json();
    const { amount, accountNumber, bankCode, accountName } = body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Minimum withdrawal amount (₦100)
    if (amount < 100) {
      return NextResponse.json(
        { error: 'Minimum withdrawal amount is ₦100' },
        { status: 400 }
      );
    }

    if (!accountNumber || !bankCode || !accountName) {
      return NextResponse.json(
        { error: 'Bank account details are required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Failed to fetch user balance' },
        { status: 500 }
      );
    }

    if (profile.balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // Check withdrawal limits
    const { data: limitCheck, error: limitError } = await supabase
      .rpc('check_withdrawal_limits', {
        user_id_param: user.id,
        amount_param: amount,
      });

    if (limitError || !limitCheck || limitCheck.length === 0) {
      return NextResponse.json(
        { error: 'Failed to check withdrawal limits' },
        { status: 500 }
      );
    }

    const limitResult = limitCheck[0];
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: limitResult.reason || 'Withdrawal limit exceeded' },
        { status: 400 }
      );
    }

    // Get Paystack secret key
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY is not set');
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
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
      console.error('Error creating withdrawal:', withdrawalError);
      return NextResponse.json(
        { error: 'Failed to create withdrawal request' },
        { status: 500 }
      );
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

      return NextResponse.json(
        { error: 'Failed to process withdrawal' },
        { status: 500 }
      );
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

      return NextResponse.json(
        { error: recipientData.message || 'Failed to process withdrawal' },
        { status: recipientResponse.status || 500 }
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

      return NextResponse.json(
        { error: transferData.message || 'Failed to process withdrawal' },
        { status: transferResponse.status || 500 }
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

      return NextResponse.json({
        success: true,
        message: 'Withdrawal request submitted successfully',
        withdrawal: {
          id: withdrawal.id,
          amount: amount,
          status: 'processing',
          reference: reference,
        },
      });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

