"use client";

import { MobileNav } from "@/components/mobile-nav";
import { Footer } from "@/components/footer";
import { usePathname } from "next/navigation";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const isLandingPage = pathname === "/landing" || pathname === "/";
  
  // Public pages that should have footer but no sidebar nav
  const publicPages = [
    "/about",
    "/terms",
    "/privacy",
    "/faq",
    "/contact",
    "/help",
  ];
  const isPublicPage = pathname && publicPages.includes(pathname);

  // App routes (user dashboard) - no footer, with sidebar nav
  const appRoutes = [
    "/wagers",
    "/wallet",
    "/profile",
    "/create",
    "/notifications",
    "/preferences",
    "/leaderboard",
  ];
  const isAppRoute = pathname && (appRoutes.includes(pathname) || pathname.startsWith("/wager/"));

  // Hide regular navigation for admin routes (admin has its own sidebar)
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // Landing page - no nav, but include footer
  if (isLandingPage) {
    return (
      <div className="flex flex-col min-h-screen">
        {children}
        <Footer />
      </div>
    );
  }

  // Public pages - no sidebar nav, but include footer
  if (isPublicPage) {
    return (
      <div className="flex flex-col min-h-screen">
        {children}
        <Footer />
      </div>
    );
  }

  // App routes - include navigation but no footer
  if (isAppRoute) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-col md:flex-row flex-1">
          <MobileNav />
          <div className="flex-1 md:ml-0 flex flex-col min-h-screen">
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  // Default fallback - include navigation and footer
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-col md:flex-row flex-1">
        <MobileNav />
        <div className="flex-1 md:ml-0 flex flex-col min-h-screen">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </div>
    </div>
  );
}

