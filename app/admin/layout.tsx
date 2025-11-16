"use client";

import { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Toaster } from "@/components/ui/toaster";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-col md:flex-row flex-1">
        <AdminSidebar />
        <div className="flex-1 md:ml-0 flex flex-col min-h-screen">
          <div className="flex-1">{children}</div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

