import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get Paystack secret key
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    // Fetch banks from Paystack
    const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch banks' },
        { status: response.status || 500 }
      );
    }

    // Remove duplicates by bank code (Paystack sometimes returns duplicates)
    const bankMap = new Map<string, { code: string; name: string }>();
    data.data.forEach((bank: any) => {
      if (bank.code && bank.name && !bankMap.has(bank.code)) {
        bankMap.set(bank.code, {
          code: bank.code,
          name: bank.name,
        });
      }
    });

    const uniqueBanks = Array.from(bankMap.values());
    // Sort alphabetically by name
    uniqueBanks.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      banks: uniqueBanks,
    });
  } catch (error) {
    console.error('Error fetching banks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

