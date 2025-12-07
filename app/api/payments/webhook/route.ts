import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-handler';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const hash = crypto
      .createHmac('sha512', paystackSecretKey)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);

    // Handle successful charge event
    if (event.event === 'charge.success') {
      const transaction = event.data;
      const userId = transaction.metadata?.userId;
      const reference = transaction.reference;

      if (!userId || !reference) {
        return NextResponse.json(
          { error: 'Invalid transaction data' },
          { status: 400 }
        );
      }

      // Use service role client to bypass RLS for webhook processing
      // This is safe because we've already verified the webhook signature
      let supabase;
      try {
        supabase = createServiceRoleClient();
      } catch (error) {
        console.error('Supabase service role key not configured');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      // Check if already processed (idempotency check)
      const { data: existingTransaction, error: existingTransactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .eq('type', 'deposit')
        .maybeSingle();

      if (existingTransactionError && existingTransactionError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine - not a real error
        logError(new Error(`Error checking existing transaction: ${existingTransactionError.message}`), {
          existingTransactionError,
          reference,
        });
        // Continue processing - don't fail webhook for this
      }

      if (existingTransaction) {
        // Already processed - return success to acknowledge webhook
        return NextResponse.json({ status: 'already_processed' });
      }

      // Amount in kobo, convert to main currency
      const amount = transaction.amount / 100;

      // Delete any pending transaction if exists (cleanup from old code)
      await supabase
        .from('transactions')
        .delete()
        .eq('reference', reference)
        .eq('type', 'deposit_pending');

      // Create transaction record first (with unique constraint, this will fail if duplicate)
      const { data: newTransaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'deposit',
          amount: amount,
          reference: reference,
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      // If transaction insert fails due to duplicate, it was already processed
      if (transactionError) {
        // Check if it's a unique constraint violation (duplicate)
        if (transactionError.code === '23505' || transactionError.message?.includes('duplicate')) {
          // Already processed - return success to acknowledge webhook
          return NextResponse.json({ status: 'already_processed' });
        }
        logError(new Error(`Error creating transaction record: ${transactionError.message}`), { 
          transactionError,
          reference,
          userId,
          amount 
        });
        // Don't update balance if transaction creation failed
        return NextResponse.json(
          { error: 'Failed to create transaction record' },
          { status: 500 }
        );
      }

      // Only update balance if transaction was successfully created
      if (!newTransaction) {
        logError(new Error('Transaction insert returned no data'), {
          reference,
          userId,
          amount
        });
        return NextResponse.json(
          { error: 'Failed to create transaction record' },
          { status: 500 }
        );
      }

      // Update balance after transaction record is created
      const { error: balanceError } = await supabase.rpc('increment_balance', {
        user_id: userId,
        amt: amount,
      });

      if (balanceError) {
        logError(new Error(`Error updating balance from webhook: ${balanceError.message}`), {
          balanceError,
          reference,
          userId,
          amount,
          transactionId: newTransaction.id
        });
        // Transaction record was created but balance update failed
        // This is a critical error - log it for manual intervention
        return NextResponse.json(
          { error: 'Failed to update balance' },
          { status: 500 }
        );
      }

      // Successfully processed - transaction created and balance updated
      // Log success for debugging (using console.log instead of logError for success)
      console.log('Payment processed successfully via webhook', {
        reference,
        userId,
        amount,
        transactionId: newTransaction.id
      });
    }

    // Handle transfer events (withdrawals)
    if (event.event === 'transfer.success') {
      const transfer = event.data;
      const reference = transfer.reference;

      if (!reference) {
        return NextResponse.json(
          { error: 'Invalid transfer data' },
          { status: 400 }
        );
      }

      // Use service role client to bypass RLS for webhook processing
      // This is safe because we've already verified the webhook signature
      let supabase;
      try {
        supabase = createServiceRoleClient();
      } catch (error) {
        console.error('Supabase service role key not configured');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      // Find withdrawal by reference
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('reference', reference)
        .maybeSingle();

      if (withdrawalError || !withdrawal) {
        console.error('Withdrawal not found:', withdrawalError);
        return NextResponse.json({ status: 'withdrawal_not_found' });
      }

      // Update withdrawal status
      await supabase
        .from('withdrawals')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawal.id);

      // Update transaction description
      await supabase
        .from('transactions')
        .update({
          description: `Withdrawal completed: ₦${withdrawal.amount.toLocaleString()} to ${withdrawal.bank_account?.account_name || 'bank account'}`,
        })
        .eq('reference', reference)
        .eq('type', 'withdrawal');
    }

    // Handle failed transfers
    if (event.event === 'transfer.failed') {
      const transfer = event.data;
      const reference = transfer.reference;

      if (!reference) {
        return NextResponse.json(
          { error: 'Invalid transfer data' },
          { status: 400 }
        );
      }

      // Use service role client to bypass RLS for webhook processing
      // This is safe because we've already verified the webhook signature
      let supabase;
      try {
        supabase = createServiceRoleClient();
      } catch (error) {
        console.error('Supabase service role key not configured');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      // Find withdrawal by reference
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('reference', reference)
        .maybeSingle();

      if (withdrawalError || !withdrawal) {
        console.error('Withdrawal not found:', withdrawalError);
        return NextResponse.json({ status: 'withdrawal_not_found' });
      }

      // Refund the balance
      await supabase.rpc('increment_balance', {
        user_id: withdrawal.user_id,
        amt: withdrawal.amount,
      });

      // Update withdrawal status
      await supabase
        .from('withdrawals')
        .update({
          status: 'failed',
          failure_reason: transfer.reason || 'Transfer failed',
        })
        .eq('id', withdrawal.id);

      // Update transaction
      await supabase
        .from('transactions')
        .update({
          description: `Withdrawal failed: ₦${withdrawal.amount.toLocaleString()} - ${transfer.reason || 'Transfer failed'}. Amount refunded.`,
        })
        .eq('reference', reference)
        .eq('type', 'withdrawal');
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

