import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    
    // Get token from cookies (optional for profile viewing, but needed for follow status)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch(`/social/profile/${userId}`, {
      method: 'GET',
      token,
      requireAuth: false, // Profile can be viewed without auth, but token helps get follow status
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to get profile' },
        { status: 500 },
      );
    }

    // nestjsServerFetch returns the full response object from backend
    // Backend returns: { success: true, data: { profile: {...} } }
    // nestjsServerFetch returns the whole backend response: { success: true, data: { profile: {...} } }
    // So response.data is { profile: {...} }
    
    // Ensure we always return { success: true, data: { profile: {...} } }
    const profileData = response.data;
    
    // If profileData has a profile property, use it directly
    if (profileData && typeof profileData === 'object' && 'profile' in profileData) {
      return NextResponse.json({
        success: true,
        data: profileData,
      });
    }
    
    // If profileData is the profile object itself, wrap it
    if (profileData && typeof profileData === 'object' && 'id' in profileData) {
      return NextResponse.json({
        success: true,
        data: { profile: profileData },
      });
    }
    
    // Fallback: wrap whatever we got
    return NextResponse.json({
      success: true,
      data: { profile: profileData },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get profile' },
      { status: 500 },
    );
  }
}

