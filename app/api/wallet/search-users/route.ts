import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/wallet/search-users
 * Search for users by username (for transfers)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(); // User must be authenticated to search
    // Use service role client to bypass RLS for search (user is already authenticated)
    const supabase = createServiceRoleClient();

    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    if (!query || query.trim().length < 2) {
      return successResponseNext({ users: [] });
    }

    // Remove @ if present
    const searchQuery = query.trim().replace(/^@+/, '').toLowerCase();

    if (!searchQuery || searchQuery.length < 2) {
      return successResponseNext({ users: [] });
    }

    // Always use separate queries for username and email (more reliable than OR)
    const [usernameResults, emailResults] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .not('username', 'is', null)
        .limit(10),
      supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .ilike('email', `%${searchQuery}%`)
        .not('username', 'is', null)
        .limit(10),
    ]);

    // Check for errors
    if (usernameResults.error) {
      console.error('Username search error:', usernameResults.error);
      throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to search users by username: ${usernameResults.error.message}`);
    }

    if (emailResults.error) {
      console.error('Email search error:', emailResults.error);
      // Don't throw if email search fails, just log it
    }

    // Combine results and remove duplicates
    const combined = [
      ...(usernameResults.data || []),
      ...(emailResults.data || []),
    ];

    const uniqueProfiles = Array.from(
      new Map(combined.map(p => [p.id, p])).values()
    ).slice(0, 10);

    // Format response - include email for display
    const users = uniqueProfiles.map(profile => ({
      id: profile.id,
      username: profile.username,
      email: profile.email || undefined,
      avatar_url: profile.avatar_url || undefined,
    }));

    return successResponseNext({ users });
  } catch (error) {
    console.error('Search users API error:', error);
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

