import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AppError, formatErrorResponse, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.redirect(new URL('/wallet?error=missing_reference', request.url));
    }

    // Verify payment with Paystack
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      logError(new Error('PAYSTACK_SECRET_KEY is not set'));
      return NextResponse.redirect(new URL('/wallet?error=config_error', request.url));
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      logError(new Error(`Paystack verification error: ${paystackData.message}`), { paystackData });
      return NextResponse.redirect(new URL('/wallet?error=verification_failed', request.url));
    }

    const transaction = paystackData.data;
    const userId = transaction.metadata?.userId;

    if (!userId) {
      return NextResponse.redirect(new URL('/wallet?error=invalid_transaction', request.url));
    }

    // Check if transaction was successful
    if (transaction.status !== 'success') {
      return NextResponse.redirect(new URL('/wallet?error=payment_failed', request.url));
    }

    const supabase = await createClient();

    // Check if transaction already processed
    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .eq('type', 'deposit')
      .single();

    if (existingTransaction) {
      // Transaction already processed
      return NextResponse.redirect(new URL('/wallet?success=already_processed', request.url));
    }

    // Amount in kobo, convert to main currency
    const amount = transaction.amount / 100;

    // Update user balance
    const { error: balanceError } = await supabase.rpc('increment_balance', {
      user_id: userId,
      amt: amount,
    });

    if (balanceError) {
      logError(new Error(`Error updating balance: ${balanceError.message}`), { balanceError });
      return NextResponse.redirect(new URL('/wallet?error=balance_update_failed', request.url));
    }

    // Delete any pending transaction if exists (cleanup from old code)
    await supabase
      .from('transactions')
      .delete()
      .eq('reference', reference)
      .eq('type', 'deposit_pending');

    // Create successful deposit transaction
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount: amount,
        reference: reference,
        created_at: new Date().toISOString(),
      });

    if (transactionError) {
      logError(new Error(`Error creating transaction record: ${transactionError.message}`), { transactionError });
      // Balance was updated, so continue anyway
    }

    return NextResponse.redirect(new URL(`/wallet?success=true&amount=${amount}`, request.url));
  } catch (error) {
    logError(error as Error);
    return NextResponse.redirect(new URL('/wallet?error=verification_error', request.url));
  }
}

