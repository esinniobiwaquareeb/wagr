import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to get profile
    const response = await nestjsServerFetch<any>('/users/profile', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch profile');
    }

    return successResponseNext({ profile: response.data });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/profile
 * Update user profile
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { username, avatar_url } = body;
    let profileData: any = null;

    // If username is being updated, use the username endpoint
    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (!trimmedUsername || trimmedUsername.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }
      if (trimmedUsername.length > 30) {
        throw new Error('Username must be less than 30 characters');
      }
      const usernameRegex = /^[a-zA-Z0-9_-]+$/;
      if (!usernameRegex.test(trimmedUsername)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }

      // Update username via dedicated endpoint
      const usernameResponse = await nestjsServerFetch<any>('/users/username', {
        method: 'PATCH',
        token,
        requireAuth: true,
        body: JSON.stringify({ username: trimmedUsername }),
      });

      if (!usernameResponse.success || !usernameResponse.data) {
        throw new Error(usernameResponse.error?.message || 'Failed to update username');
      }

      profileData = usernameResponse.data;
    }

    // If avatar_url is being updated, use the profile endpoint
    if (avatar_url !== undefined) {
      const profileResponse = await nestjsServerFetch<any>('/users/profile', {
        method: 'PATCH',
        token,
        requireAuth: true,
        body: JSON.stringify({ avatar_url }),
      });

      if (!profileResponse.success || !profileResponse.data) {
        throw new Error(profileResponse.error?.message || 'Failed to update profile');
      }

      // If we already have profileData from username update, merge it
      profileData = profileData ? { ...profileData, ...profileResponse.data } : profileResponse.data;
    }

    if (!profileData) {
      throw new Error('No fields to update');
    }

    return successResponseNext({ profile: profileData });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

