"use client";

import { MobileNav } from "@/components/mobile-nav";
import { Footer } from "@/components/footer";
import { usePathname } from "next/navigation";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // Hide regular navigation for admin routes (admin has its own sidebar)
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // Regular routes - include navigation and footer
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

