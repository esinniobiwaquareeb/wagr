// API endpoint for creating system-generated wagers
// This can be called by cron jobs or external services to automatically create wagers

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getWagerPlatformFee } from "@/lib/settings";

interface SystemWagerRequest {
  title: string;
  description?: string;
  amount: number;
  side_a: string;
  side_b: string;
  deadline?: string;
  category: string;
  source_data?: Record<string, any>;
  currency?: string;
}

export async function POST(request: Request) {
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
    const body: SystemWagerRequest = await request.json();
    
    // Validate required fields
    if (!body.title || !body.side_a || !body.side_b || !body.amount || !body.category) {
      return NextResponse.json(
        { error: "Missing required fields: title, side_a, side_b, amount, category" },
        { status: 400 }
      );
    }

    // Use service role key for system wagers
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if similar wager already exists (prevent duplicates)
    const { data: existingWagers } = await supabase
      .from("wagers")
      .select("id")
      .eq("title", body.title)
      .eq("category", body.category)
      .eq("is_system_generated", true)
      .eq("status", "OPEN")
      .limit(1);

    if (existingWagers && existingWagers.length > 0) {
      return NextResponse.json(
        { 
          error: "Similar wager already exists",
          wager_id: existingWagers[0].id 
        },
        { status: 409 }
      );
    }
    
    // Get the configured platform fee
    const platformFee = await getWagerPlatformFee();
    
    // Create the wager
    const { data: wager, error } = await supabase
      .from("wagers")
      .insert({
        creator_id: null, // System-generated wagers have no creator
        title: body.title,
        description: body.description || null,
        amount: body.amount,
        side_a: body.side_a,
        side_b: body.side_b,
        deadline: body.deadline ? new Date(body.deadline).toISOString() : null,
        category: body.category,
        is_system_generated: true,
        source_data: body.source_data || null,
        currency: body.currency || "NGN",
        fee_percentage: platformFee,
        status: "OPEN",
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error creating system wager:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      wager,
      message: "System wager created successfully" 
    });
  } catch (error) {
    console.error("Error in create-system-wager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

