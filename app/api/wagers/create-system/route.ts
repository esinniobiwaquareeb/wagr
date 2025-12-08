// API endpoint for creating system-generated wagers
// This can be called by cron jobs or external services to automatically create wagers

import { NextRequest, NextResponse } from "next/server";

const NESTJS_API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1';

export async function POST(request: NextRequest) {
  // Verify this is called from an authorized source
  const authHeader = request.headers.get("authorization");
  const apiSecret = process.env.SYSTEM_WAGER_API_SECRET;
  
  if (!apiSecret) {
    return NextResponse.json(
      { error: "SYSTEM_WAGER_API_SECRET is not configured" },
      { status: 500 }
    );
  }
  
  if (authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.title || !body.side_a || !body.side_b || !body.amount || !body.category) {
      return NextResponse.json(
        { error: "Missing required fields: title, side_a, side_b, amount, category" },
        { status: 400 }
      );
    }

    // Call NestJS backend
    const response = await fetch(`${NESTJS_API_BASE}/system/wagers/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || data.message || 'Failed to create system wager' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in create-system-wager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

