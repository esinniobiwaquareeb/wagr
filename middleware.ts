import { type NextRequest, NextResponse } from "next/server";
import { verifyJWTToken } from "@/lib/nestjs-server";

export async function middleware(request: NextRequest) {
  // Skip middleware for static files and API routes (except auth)
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.startsWith('/icons') ||
    request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp)$/)
  ) {
    return NextResponse.next();
  }

  // Get JWT token from cookie
  const token = request.cookies.get('auth_token')?.value || request.cookies.get('wagr_session')?.value;

  if (token) {
    // Verify JWT token is valid
    const user = await verifyJWTToken(token);
    
    if (user) {
      // Token is valid, continue
      return NextResponse.next();
    } else {
      // Invalid token, clear cookie
      const response = NextResponse.next();
      response.cookies.delete('auth_token');
      response.cookies.delete('wagr_session');
      return response;
    }
  }

  // No token, continue (public routes are allowed)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
