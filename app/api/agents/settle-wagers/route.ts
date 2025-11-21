// Vercel AI Agent for wager settlement
// This agent handles resulting, winnings computation, and settlements
// Configured to run periodically (adjust schedule in Vercel dashboard)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Note: Using Node.js runtime for better compatibility with Supabase
// export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify this is called from Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get expired wagers that need AI analysis for settlement
    const { data: expiredWagers } = await supabase
      .from('wagers')
      .select('id, title, description, deadline, winning_side, status')
      .eq('status', 'OPEN')
      .not('deadline', 'is', null)
      .lte('deadline', new Date().toISOString())
      .is('winning_side', null)
      .limit(10);
    
    // Use AI to determine outcomes for wagers without winning_side
    if (expiredWagers && expiredWagers.length > 0) {
      const aiApiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
      
      if (aiApiKey) {
        const { analyzeNewsForSettlement } = await import("@/lib/ai/news-analyzer");
        
        for (const wager of expiredWagers) {
          try {
            const analysis = await analyzeNewsForSettlement(
              wager.title,
              wager.description || '',
              wager.deadline,
              aiApiKey
            );
            
            if (analysis.winningSide && analysis.confidence >= 70) {
              // Update wager with AI-determined winning side
              await supabase
                .from('wagers')
                .update({ 
                  winning_side: analysis.winningSide.toUpperCase(),
                  source_data: {
                    ai_settlement: true,
                    ai_reasoning: analysis.reasoning,
                    ai_confidence: analysis.confidence,
                  }
                })
                .eq('id', wager.id);
            }
          } catch (error) {
            console.error(`Error analyzing wager ${wager.id}:`, error);
          }
        }
      }
    }
    
    // Call the database function to check and settle expired wagers
    // This function already handles single-participant refunds internally
    const { data, error } = await supabase.rpc("check_and_settle_expired_wagers");

    if (error) {
      console.error("Error settling wagers:", error);
      return NextResponse.json({ 
        error: error.message,
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Wager settlement agent completed",
      timestamp: new Date().toISOString(),
      settlementResult: data,
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

