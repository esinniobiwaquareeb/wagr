import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch(`/social/follow/${userId}`, {
      method: 'POST',
      token,
      requireAuth: true,
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to follow user' },
        { status: 500 },
      );
    }

    return NextResponse.json(response.data || response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to follow user' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch(`/social/follow/${userId}`, {
      method: 'DELETE',
      token,
      requireAuth: true,
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to unfollow user' },
        { status: 500 },
      );
    }

    return NextResponse.json(response.data || response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to unfollow user' },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch(`/social/follow/${userId}`, {
      method: 'GET',
      token,
      requireAuth: true,
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to check follow status' },
        { status: 500 },
      );
    }

    return NextResponse.json(response.data || response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check follow status' },
      { status: 500 },
    );
  }
}

