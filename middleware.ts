import { type NextRequest, NextResponse } from "next/server";
import { getUserIdFromSession } from "@/lib/auth/session";

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

  // Get session token from cookie
  const sessionToken = request.cookies.get('wagr_session')?.value;

  if (sessionToken) {
    // Verify session is valid
    const userId = await getUserIdFromSession(sessionToken);
    
    if (userId) {
      // Session is valid, continue
      return NextResponse.next();
    } else {
      // Invalid session, clear cookie
      const response = NextResponse.next();
      response.cookies.delete('wagr_session');
      return response;
    }
  }

  // No session, continue (public routes are allowed)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
