"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Toaster } from "@/components/ui/toaster";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only check pathname after mount to avoid hydration mismatch
  // During SSR and initial render, always show sidebar structure
  const isLoginPage = mounted && pathname === "/admin/login";

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-col md:flex-row flex-1">
        {!isLoginPage && <AdminSidebar />}
        <div className="flex-1 md:ml-0 flex flex-col min-h-screen">
          <div className="flex-1">{children}</div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

