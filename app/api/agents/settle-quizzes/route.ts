import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-handler';

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
    const serviceSupabase = createServiceRoleClient();
    
    // Call the database function to check and settle completed quizzes
    const { data, error } = await serviceSupabase.rpc('check_and_settle_completed_quizzes');

    if (error) {
      logError(new Error(`Failed to settle quizzes: ${error.message}`), { error });
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          message: 'Failed to check and settle quizzes'
        },
        { status: 500 }
      );
    }

    // Get count of quizzes that were settled (optional - for logging)
    const { data: settledQuizzes } = await serviceSupabase
      .from('quizzes')
      .select('id')
      .eq('status', 'settled')
      .not('settled_at', 'is', null)
      .gte('settled_at', new Date(Date.now() - 60000).toISOString()); // Settled in last minute

    return NextResponse.json({
      success: true,
      message: 'Quiz settlement check completed',
      settledCount: settledQuizzes?.length || 0,
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

