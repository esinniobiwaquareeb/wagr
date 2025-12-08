// Vercel AI Agent for wager settlement
// This agent handles resulting, winnings computation, and settlements
// Configured to run periodically (adjust schedule in Vercel dashboard)

import { NextRequest, NextResponse } from "next/server";

const NESTJS_API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1';

export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify this is called from Vercel Cron
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

    // Call NestJS backend to settle wagers
    const response = await fetch(`${NESTJS_API_BASE}/system/wagers/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { 
          error: "Wager settlement failed",
          message: data.error || data.message || 'Unknown error'
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Wager settlement agent completed",
      timestamp: new Date().toISOString(),
      settlementResult: data.data || data,
    });
  } catch (error) {
    console.error("Error in settle-wagers agent:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

