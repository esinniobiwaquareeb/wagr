import { NextResponse } from 'next/server';

// Service worker will be served from public/sw.js
// This route is a fallback if needed
export async function GET() {
  return NextResponse.redirect(new URL('/sw.js', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
}

