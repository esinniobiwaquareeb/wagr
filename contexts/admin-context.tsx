"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentAdmin, type AdminAuthUser } from "@/lib/auth/client";

interface AdminContextType {
  admin: AdminAuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  refreshAdmin: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminAuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAdmin = async () => {
    try {
      const currentAdmin = await getCurrentAdmin(true);
      if (!currentAdmin?.id) {
        setAdmin(null);
        setIsAdmin(false);
        router.replace("/admin/login");
        return;
      }

      setAdmin(currentAdmin);
      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setAdmin(null);
      setIsAdmin(false);
      router.replace("/admin/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    refreshAdmin().then(() => {
      if (mounted) {
        setLoading(false);
      }
    });

    // Listen for auth state changes (e.g., after login)
    const handleAuthStateChange = () => {
      if (mounted) {
        refreshAdmin();
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChange);

    return () => {
      mounted = false;
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, [router]);

  return (
    <AdminContext.Provider value={{ admin, isAdmin, loading, refreshAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
