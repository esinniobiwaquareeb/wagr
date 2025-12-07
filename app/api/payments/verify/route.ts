import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-handler';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref'); // Paystack also uses 'trxref' parameter

    // Use trxref if reference is not available (Paystack sometimes uses trxref)
    const paymentReference = reference || trxref;

    if (!paymentReference) {
      // User likely closed the payment modal without completing payment
      // Just redirect back to wallet without error (silent failure)
      return NextResponse.redirect(new URL('/wallet', request.url));
    }

    // Verify payment with Paystack
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      logError(new Error('PAYSTACK_SECRET_KEY is not set'));
      return NextResponse.redirect(new URL('/wallet?error=config_error', request.url));
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${paymentReference}`,
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
      // Payment was cancelled or failed - just redirect back to wallet silently
      // Don't show error to avoid confusion if user intentionally cancelled
      return NextResponse.redirect(new URL('/wallet', request.url));
    }

    // Use service role client to check transaction status
    // NOTE: We don't process the payment here - the webhook handles that
    // This route is only for user feedback after payment redirect
    let supabase;
    try {
      supabase = createServiceRoleClient();
    } catch (error) {
      logError(new Error('Supabase service role key not configured'));
      return NextResponse.redirect(new URL('/wallet?error=config_error', request.url));
    }

    // Amount in kobo, convert to main currency
    const amount = transaction.amount / 100;

    // Check if transaction already processed (by webhook)
    // Wait a bit first to give webhook time to process (webhook is usually faster)
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for webhook
    
    const { data: existingTransaction, error: checkError } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', paymentReference)
      .eq('type', 'deposit')
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      logError(new Error(`Error checking existing transaction: ${checkError.message}`), { checkError, paymentReference });
      // Continue processing - don't fail for this
    }

    if (existingTransaction) {
      // Transaction already processed by webhook
      return NextResponse.redirect(new URL(`/wallet?success=true&amount=${amount}`, request.url));
    }

    // Transaction not yet processed - process it here as fallback
    // (Webhook might be delayed or failed)
    // Use a transaction to ensure atomicity
    try {
      // Delete any pending transaction if exists (cleanup from old code)
      await supabase
        .from('transactions')
        .delete()
        .eq('reference', paymentReference)
        .eq('type', 'deposit_pending');

      // Create transaction record first (this will fail if webhook already created it)
      const { data: newTransaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'deposit',
          amount: amount,
          reference: paymentReference,
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      // If transaction insert fails due to duplicate, it was already processed by webhook
      if (transactionError) {
        // Check if it's a unique constraint violation (duplicate)
        if (transactionError.code === '23505' || transactionError.message?.includes('duplicate')) {
          // Already processed by webhook - just redirect with success
          return NextResponse.redirect(new URL(`/wallet?success=true&amount=${amount}`, request.url));
        }
        logError(new Error(`Error creating transaction record: ${transactionError.message}`), { transactionError });
        // If it's not a duplicate error, something else went wrong - don't update balance
        return NextResponse.redirect(new URL(`/wallet?success=pending&amount=${amount}`, request.url));
      }

      // Only update balance if we successfully created the transaction
      if (newTransaction) {
        const { error: balanceError } = await supabase.rpc('increment_balance', {
          user_id: userId,
          amt: amount,
        });

        if (balanceError) {
          logError(new Error(`Error updating balance: ${balanceError.message}`), { balanceError });
          // Transaction was created but balance update failed - this is a critical error
          return NextResponse.redirect(new URL('/wallet?error=balance_update_failed', request.url));
        }
      }

      // Successfully processed
      return NextResponse.redirect(new URL(`/wallet?success=true&amount=${amount}`, request.url));
    } catch (processError) {
      logError(processError as Error);
      // If processing fails, redirect with pending - webhook might process it later
      return NextResponse.redirect(new URL(`/wallet?success=pending&amount=${amount}`, request.url));
    }
  } catch (error) {
    logError(error as Error);
    return NextResponse.redirect(new URL('/wallet?error=verification_error', request.url));
  }
}

