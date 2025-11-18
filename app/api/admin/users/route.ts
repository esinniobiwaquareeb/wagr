import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    // Verify admin access
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role to get all users with emails
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message },
        { status: 500 }
      );
    }

    // Get all auth users with emails
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();

    if (authUsersError) {
      return NextResponse.json(
        { error: authUsersError.message },
        { status: 500 }
      );
    }

    // Get user statistics
    const userIds = profiles?.map(p => p.id) || [];
    
    // Get wagers created count per user
    const { data: wagersData } = await supabaseAdmin
      .from("wagers")
      .select("creator_id")
      .in("creator_id", userIds);
    
    const wagersCountByUser = new Map<string, number>();
    wagersData?.forEach(wager => {
      if (wager.creator_id) {
        wagersCountByUser.set(wager.creator_id, (wagersCountByUser.get(wager.creator_id) || 0) + 1);
      }
    });
    
    // Get entries count per user
    const { data: entriesData } = await supabaseAdmin
      .from("wager_entries")
      .select("user_id")
      .in("user_id", userIds);
    
    const entriesCountByUser = new Map<string, number>();
    entriesData?.forEach(entry => {
      entriesCountByUser.set(entry.user_id, (entriesCountByUser.get(entry.user_id) || 0) + 1);
    });
    
    // Get total wagered amount per user
    const { data: entriesWithAmounts } = await supabaseAdmin
      .from("wager_entries")
      .select("user_id, amount")
      .in("user_id", userIds);
    
    const totalWageredByUser = new Map<string, number>();
    entriesWithAmounts?.forEach(entry => {
      const current = totalWageredByUser.get(entry.user_id) || 0;
      totalWageredByUser.set(entry.user_id, current + Number(entry.amount || 0));
    });

    // Merge profiles with auth user emails and stats
    const usersWithEmails = profiles?.map((profile) => {
      const authUser = authUsers?.users.find((u) => u.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || null,
        wagers_created: wagersCountByUser.get(profile.id) || 0,
        entries_count: entriesCountByUser.get(profile.id) || 0,
        total_wagered: totalWageredByUser.get(profile.id) || 0,
      };
    }) || [];

    return NextResponse.json({ users: usersWithEmails });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

