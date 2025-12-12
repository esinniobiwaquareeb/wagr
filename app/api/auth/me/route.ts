import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';
import { cookies } from 'next/headers';

/**
 * Decode JWT token payload without validation
 * JWT format: header.payload.signature
 */
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    // Decode base64url encoded payload (middle part)
    const payload = parts[1];
    // Replace URL-safe base64 characters
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return successResponseNext({ user: null });
    }

    // Decode token to check type
    const payload = decodeJwtPayload(token);
    const isAdminToken = payload?.type === 'admin';
    
    // Route to appropriate endpoint based on token type
    // IMPORTANT: Admin tokens must NEVER call /auth/me (user endpoint)
    if (isAdminToken) {
      // Admin token - use admin endpoint ONLY (never call /auth/me)
      const adminResponse = await nestjsServerFetch<{
        admin: {
          id: string;
          email: string;
          username: string | null;
          full_name: string | null;
          role: string;
          is_active: boolean;
        };
      }>('/admin/me', {
        method: 'GET',
        token,
        requireAuth: true,
      });

      // nestjsServerFetch returns { success: false, error: ... } on failure
      // or the data directly on success (which is { admin: {...} } from backend)
      if (adminResponse.success === false) {
        // Admin endpoint failed
        return successResponseNext({ user: null });
      }

      // Backend returns { admin: {...} }, TransformInterceptor wraps it as { success: true, data: { admin: {...} } }
      // nestjsServerFetch returns the entire response, so we need to access response.data.admin
      const admin = (adminResponse as any).data?.admin || (adminResponse as any).admin;
      if (admin) {
        return successResponseNext({
          user: {
            id: admin.id,
            email: admin.email,
            username: admin.username,
            email_verified: true, // Admins don't have email verification
            is_admin: true,
          },
        });
      }

      // No admin data found
      return successResponseNext({ user: null });
    } else {
      // User token (or token couldn't be decoded) - use user endpoint
      // Note: User tokens should NOT have is_admin field since admins are separate
      const userResponse = await nestjsServerFetch<{
        user: {
          id: string;
          email: string;
          username: string | null;
          email_verified: boolean;
        };
      }>('/auth/me', {
        method: 'GET',
        token,
        requireAuth: true,
      });

      // nestjsServerFetch returns { success: false, error: ... } on failure
      // or { success: true, data: {...} } on success (wrapped by TransformInterceptor)
      if (userResponse.success === false) {
        // User endpoint failed
        return successResponseNext({ user: null });
      }

      // Backend returns { user: {...} }, TransformInterceptor wraps it as { success: true, data: { user: {...} } }
      // nestjsServerFetch returns the entire response, so we need to access response.data.user
      const user = (userResponse as any).data?.user || (userResponse as any).user;
      if (user) {
        return successResponseNext({
          user,
        });
      }

      // No user data found
      return successResponseNext({ user: null });
    }
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

