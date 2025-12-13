"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Toaster } from "@/components/ui/toaster";
import { AdminProvider, useAdmin } from "@/contexts/admin-context";

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, isAdmin, loading } = useAdmin();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoginPage = mounted && pathname === "/admin/login";

  // Show loading state only for non-login pages
  if (!isLoginPage && loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex flex-col md:flex-row flex-1">
          <AdminSidebar />
          <div className="flex-1 md:ml-0 flex flex-col min-h-screen overflow-x-hidden">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground">Loading admin panel...</p>
              </div>
            </div>
          </div>
        </div>
        <Toaster />
      </div>
    );
  }

  // Redirect to login if not admin (except on login page)
  if (!isLoginPage && mounted && !loading && !isAdmin) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex flex-col md:flex-row flex-1">
          <div className="flex-1 md:ml-0 flex flex-col min-h-screen overflow-x-hidden">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Redirecting to admin login...</p>
              </div>
            </div>
          </div>
        </div>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex flex-col md:flex-row flex-1">
        {!isLoginPage && <AdminSidebar />}
        <div className="flex-1 md:ml-0 flex flex-col min-h-screen overflow-x-hidden">
          <div className="flex-1">{children}</div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminProvider>
  );
}

