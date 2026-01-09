// Vercel AI Agent for automatic wager generation
// This agent aggregates data from various sources and creates wagers automatically
// Configured to run every 2 minutes for testing (adjust in Vercel dashboard)

import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';

const NESTJS_API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000/api/v1';

export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify this is called from Vercel Cron
  // Vercel cron jobs send x-vercel-cron header automatically
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow if it's a Vercel cron (has x-vercel-cron header) OR if CRON_SECRET matches
  // In local development, allow if CRON_SECRET is not set (for easier testing)
  const isVercelCron = vercelCronHeader === "1";
  const isValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isLocalDev = process.env.NODE_ENV === 'development' && !cronSecret;
  const isAdminRequest = request.headers.get('x-admin-request') === 'true'; // Allow admin requests in dev
  
  if (!isVercelCron && !isValidSecret && cronSecret && !isAdminRequest) {
    // Only reject if CRON_SECRET is set and doesn't match (and it's not a Vercel cron or admin request)
    logger.warn('[generate-wagers] Unauthorized request', {
      hasVercelCron: !!vercelCronHeader,
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!cronSecret,
      isAdminRequest,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  if (isLocalDev || isAdminRequest) {
    logger.info('[generate-wagers] Running in local development mode (no CRON_SECRET required)');
  }
  
  logger.info('[generate-wagers] Request authenticated', {
    isVercelCron,
    hasCronSecret: !!cronSecret,
  });

  try {
    const apiSecret = process.env.SYSTEM_WAGER_API_SECRET;
    
    // In development, if secret is not set, try without it (backend might allow in dev mode)
    const isDevMode = process.env.NODE_ENV === 'development' && !apiSecret;
    
    if (!apiSecret && !isDevMode) {
      return NextResponse.json(
        { error: "SYSTEM_WAGER_API_SECRET is not configured" },
        { status: 500 }
      );
    }

    // Call NestJS backend to generate wagers (using GET for Vercel cron compatibility)
    logger.info(`[generate-wagers] Calling backend: ${NESTJS_API_BASE}/system/wagers/generate`);
    
    const headers: HeadersInit = {};
    if (apiSecret) {
      headers['Authorization'] = `Bearer ${apiSecret}`;
    }
    // In dev mode without secret, try with x-admin-request header
    if (isDevMode) {
      headers['x-admin-request'] = 'true';
    }
    
    const response = await fetch(`${NESTJS_API_BASE}/system/wagers/generate`, {
      method: 'GET',
      headers,
    });

    let data: any;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      logger.error('[generate-wagers] Failed to parse response', { 
        status: response.status, 
        statusText: response.statusText,
        text: await response.text().catch(() => 'Unable to read response')
      });
      return NextResponse.json(
        { 
          error: "Failed to parse backend response",
          message: parseError instanceof Error ? parseError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      logger.error('[generate-wagers] Backend returned error', { 
        status: response.status, 
        data 
      });
      return NextResponse.json(
        { 
          error: "Wager generation failed",
          message: data.error?.message || data.message || data.error || 'Unknown error',
          status: response.status
        },
        { status: response.status }
      );
    }

    logger.info('[generate-wagers] Generation completed successfully', { results: data.data || data });

    return NextResponse.json({
      success: true,
      message: "Wager generation agent completed",
      results: data.data || data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in generate-wagers agent", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

