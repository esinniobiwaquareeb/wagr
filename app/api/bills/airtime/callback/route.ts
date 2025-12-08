import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-handler';

const NESTJS_API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    
    // Build query string with all params
    const queryParams = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      queryParams.append(key, value);
    });

    // Call NestJS backend callback endpoint
    const response = await fetch(`${NESTJS_API_BASE}/bills/callback?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to process callback' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}

