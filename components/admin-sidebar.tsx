"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { BarChart3, Home, Users, CreditCard, Settings, Shield, LogOut, Wallet, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border md:hidden z-50 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 px-1">
          <Link
            href="/admin"
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
              isActive("/admin") && !isActive("/admin/login")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Dashboard"
          >
            <BarChart3 className={`h-6 w-6 transition-transform ${isActive("/admin") && !isActive("/admin/login") ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 font-medium">{isActive("/admin") && !isActive("/admin/login") ? "Dashboard" : ""}</span>
          </Link>
          <Link
            href="/admin/users"
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
              isActive("/admin/users")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Users"
          >
            <Users className={`h-6 w-6 transition-transform ${isActive("/admin/users") ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 font-medium">{isActive("/admin/users") ? "Users" : ""}</span>
          </Link>
          <Link
            href="/admin/wagers"
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
              isActive("/admin/wagers")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Wagers"
          >
            <Home className={`h-6 w-6 transition-transform ${isActive("/admin/wagers") ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 font-medium">{isActive("/admin/wagers") ? "Wagers" : ""}</span>
          </Link>
          <Link
            href="/admin/transactions"
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
              isActive("/admin/transactions")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Transactions"
          >
            <CreditCard className={`h-6 w-6 transition-transform ${isActive("/admin/transactions") ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 font-medium">{isActive("/admin/transactions") ? "Transactions" : ""}</span>
          </Link>
          <Link
            href="/admin/withdrawals"
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
              isActive("/admin/withdrawals")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Withdrawals"
          >
            <Wallet className={`h-6 w-6 transition-transform ${isActive("/admin/withdrawals") ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 font-medium">{isActive("/admin/withdrawals") ? "Withdrawals" : ""}</span>
          </Link>
          <Link
            href="/admin/reports"
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 ${
              isActive("/admin/reports")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Reports"
          >
            <FileText className={`h-6 w-6 transition-transform ${isActive("/admin/reports") ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 font-medium">{isActive("/admin/reports") ? "Reports" : ""}</span>
          </Link>
          {user && (
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center flex-1 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200"
              title="Logout"
            >
              <LogOut className="h-6 w-6" />
              <span className="text-[10px] mt-0.5 font-medium">Logout</span>
            </button>
          )}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-64 md:border-r md:border-border md:bg-card md:p-4 md:gap-2 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Admin Center</span>
        </div>
        
        <Link
          href="/admin"
          className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
            isActive("/admin") && !isActive("/admin/login")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <BarChart3 className="h-5 w-5" />
          <span className="text-sm font-medium">Dashboard</span>
        </Link>
        
        <Link
          href="/admin/users"
          className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
            isActive("/admin/users")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-sm font-medium">Users</span>
        </Link>
        
        <Link
          href="/admin/wagers"
          className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
            isActive("/admin/wagers")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-sm font-medium">Wagers</span>
        </Link>
        
        <Link
          href="/admin/transactions"
          className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
            isActive("/admin/transactions")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <CreditCard className="h-5 w-5" />
          <span className="text-sm font-medium">Transactions</span>
        </Link>
        
        <Link
          href="/admin/withdrawals"
          className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
            isActive("/admin/withdrawals")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Wallet className="h-5 w-5" />
          <span className="text-sm font-medium">Withdrawals</span>
        </Link>
        
        <Link
          href="/admin/reports"
          className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${
            isActive("/admin/reports")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <FileText className="h-5 w-5" />
          <span className="text-sm font-medium">Reports</span>
        </Link>

        <div className="mt-auto pt-4 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-3 py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition mb-2"
          >
            <Home className="h-5 w-5" />
            <span className="text-sm font-medium">Back to App</span>
          </Link>
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition w-full text-left"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

