import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

      const supabase = await createClient();

      // Check if already processed
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .eq('type', 'deposit')
        .single();

      if (existingTransaction) {
        // Already processed
        return NextResponse.json({ status: 'already_processed' });
      }

      // Amount in kobo, convert to main currency
      const amount = transaction.amount / 100;

      // Update balance
      const { error: balanceError } = await supabase.rpc('increment_balance', {
        user_id: userId,
        amt: amount,
      });

      if (balanceError) {
        console.error('Error updating balance from webhook:', balanceError);
        return NextResponse.json(
          { error: 'Failed to update balance' },
          { status: 500 }
        );
      }

      // Delete any pending transaction if exists (cleanup from old code)
      await supabase
        .from('transactions')
        .delete()
        .eq('reference', reference)
        .eq('type', 'deposit_pending');

      // Create successful transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'deposit',
          amount: amount,
          reference: reference,
          created_at: new Date().toISOString(),
        });
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

