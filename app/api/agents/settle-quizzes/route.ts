import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-handler';

const NESTJS_API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1';

/**
 * GET /api/agents/settle-quizzes
 * Cron job endpoint to automatically settle completed quizzes after deadline
 * This should be called periodically (e.g., every hour) to check and settle quizzes
 */
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify this is called from cron job
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const apiSecret = process.env.SYSTEM_WAGER_API_SECRET;
    
    if (!apiSecret) {
      return NextResponse.json(
        { error: "SYSTEM_WAGER_API_SECRET is not configured" },
        { status: 500 }
      );
    }

    // Call NestJS backend to settle quizzes
    const response = await fetch(`${NESTJS_API_BASE}/system/quizzes/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      logError(new Error(`Failed to settle quizzes: ${data.error || data.message}`), { data });
      return NextResponse.json(
        { 
          success: false, 
          error: data.error || data.message || 'Failed to settle quizzes',
          message: 'Failed to check and settle quizzes'
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz settlement check completed',
      settledCount: data.data?.settled || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Error during quiz settlement check'
      },
      { status: 500 }
    );
  }
}

