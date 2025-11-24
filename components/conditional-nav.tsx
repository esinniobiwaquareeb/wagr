"use client";

import { MobileNav } from "@/components/mobile-nav";
import { TopNav } from "@/components/top-nav";
import { Footer } from "@/components/footer";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdminRoute = pathname?.startsWith("/admin");
  const isLandingPage = pathname === "/landing";
  
  // Public pages that should have footer but no nav
  const publicPages = [
    "/about",
    "/terms",
    "/privacy",
    "/faq",
    "/contact",
    "/help",
  ];
  const isPublicPage = pathname && publicPages.includes(pathname);

  // App routes (user dashboard) - no footer, with top nav
  const appRoutes = [
    "/",
    "/wagers",
    "/wallet",
    "/profile",
    "/create",
    "/notifications",
    "/leaderboard",
    "/history",
    "/activity",
  ];
  const isAppRoute = pathname && (appRoutes.includes(pathname) || pathname.startsWith("/wager/"));

  // During SSR or before mount, render a consistent default to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen">
        <Suspense fallback={<div className="h-16 bg-background border-b border-border" />}>
          <TopNav />
        </Suspense>
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden lg:pt-0 pt-14 pb-20 lg:pb-0">
          <div className="flex-1">{children}</div>
        </div>
        <MobileNav />
      </div>
    );
  }

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

  // Public pages - include top nav (large screens) and mobile nav (small screens), with footer
  if (isPublicPage) {
    return (
      <div className="flex flex-col min-h-screen">
        <Suspense fallback={<div className="h-16 bg-background border-b border-border" />}>
          <TopNav />
        </Suspense>
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden lg:pt-0 pt-14 pb-20 lg:pb-0">
          <div className="flex-1">{children}</div>
        </div>
        <Footer />
        <MobileNav />
      </div>
    );
  }

  // App routes - include top nav (large screens) and mobile nav (small screens), with footer
  if (isAppRoute) {
    return (
      <div className="flex flex-col min-h-screen">
        <Suspense fallback={<div className="h-16 bg-background border-b border-border" />}>
          <TopNav />
        </Suspense>
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden lg:pt-0 pt-14 pb-20 lg:pb-0">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
        <MobileNav />
      </div>
    );
  }

  // Default fallback - include navigation and footer
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={<div className="h-16 bg-background border-b border-border" />}>
        <TopNav />
      </Suspense>
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden lg:pt-0 pt-14 pb-20 lg:pb-0">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
      <MobileNav />
    </div>
  );
}

