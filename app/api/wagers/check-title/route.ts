import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { areTitlesSimilar, generateTitleSuggestions } from '@/lib/wager-title-matcher';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

/**
 * POST /api/wagers/check-title
 * Check if a wager title is similar to existing wagers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, excludeId } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return successResponseNext({
        isDuplicate: false,
        similarWagers: [],
        suggestions: [],
      });
    }

    const supabase = await createClient();
    const trimmedTitle = title.trim();

    // Get all open wagers (excluding the current one if editing)
    let query = supabase
      .from('wagers')
      .select('id, title, side_a, side_b, amount, status, deadline, short_id')
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(50); // Check last 50 open wagers for performance

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: wagers, error } = await query;

    if (error) {
      logError(new Error(`Error checking title: ${error.message}`), { error });
      // Don't fail - just return no duplicates
      return successResponseNext({
        isDuplicate: false,
        similarWagers: [],
        suggestions: [],
      });
    }

    if (!wagers || wagers.length === 0) {
      return successResponseNext({
        isDuplicate: false,
        similarWagers: [],
        suggestions: [],
      });
    }

    // Find similar wagers
    const similarWagers = wagers
      .filter(wager => areTitlesSimilar(trimmedTitle, wager.title))
      .map(wager => ({
        id: wager.id,
        shortId: wager.short_id,
        title: wager.title,
        sideA: wager.side_a,
        sideB: wager.side_b,
        amount: wager.amount,
        deadline: wager.deadline,
      }))
      .slice(0, 5); // Return top 5 similar wagers

    // Generate suggestions if duplicates found
    const suggestions = similarWagers.length > 0
      ? generateTitleSuggestions(trimmedTitle, similarWagers.map(w => w.title))
      : [];

    return successResponseNext({
      isDuplicate: similarWagers.length > 0,
      similarWagers,
      suggestions,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

