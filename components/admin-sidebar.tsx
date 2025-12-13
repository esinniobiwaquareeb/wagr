"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { BarChart3, Home, Users, CreditCard, Settings, Shield, ShieldCheck, LogOut, Wallet, FileText, BookOpen, ChevronRight } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { adminLogout } from "@/lib/auth/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAdmin } from "@/contexts/admin-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin } = useAdmin();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleLogout = async () => {
    try {
      // Call admin logout API
      await adminLogout();
      
      // Dispatch auth state change event
      window.dispatchEvent(new Event('auth-state-changed'));
      
      // Force a full page reload to ensure all state is cleared
      // Use window.location.href for a hard redirect
      window.location.href = '/admin/login';
    } catch (error) {
      console.error('Admin logout error:', error);
      // Even if logout fails, redirect to login page
      window.location.href = '/admin/login';
    }
  };

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname.startsWith(path);
  };

  const navItems = [
    { href: "/admin", icon: BarChart3, label: "Dashboard" },
    { href: "/admin/users", icon: Users, label: "Users" },
    { href: "/admin/wagers", icon: Home, label: "Wagers" },
    { href: "/admin/quizzes", icon: BookOpen, label: "Quizzes" },
    { href: "/admin/transactions", icon: CreditCard, label: "Transactions" },
    { href: "/admin/withdrawals", icon: Wallet, label: "Withdrawals" },
    { href: "/admin/kyc", icon: ShieldCheck, label: "KYC Reviews" },
    { href: "/admin/reports", icon: FileText, label: "Reports" },
    { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <>
      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border md:hidden z-50 safe-area-inset-bottom shadow-lg">
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-2 rounded-lg transition-all duration-200 relative",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={item.label}
              >
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                <span className={cn("text-[10px] mt-0.5 font-medium", !active && "hidden")}>
                  {item.label.split(" ")[0]}
                </span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
          {admin && (
            <button
              onClick={handleLogoutClick}
              className="flex flex-col items-center justify-center flex-1 py-2 rounded-lg text-muted-foreground hover:text-destructive transition-all duration-200"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 font-medium hidden">Logout</span>
            </button>
          )}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-64 md:border-r md:border-border md:bg-card/50 md:backdrop-blur-sm md:p-4 md:gap-1 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Admin Center</p>
            {admin && (
              <p className="text-xs text-muted-foreground truncate">
                {admin.username || admin.email || 'Admin'}
              </p>
            )}
          </div>
        </div>
        
        {/* Navigation Items */}
        <div className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 group relative",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0", active && "scale-110")} />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {active && (
                  <ChevronRight className="h-4 w-4 opacity-50" />
                )}
                {!active && (
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-30 transition-opacity" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-border space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Home className="h-5 w-5" />
            <span className="text-sm font-medium">Back to App</span>
          </Link>
          {admin && (
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          )}
        </div>
      </nav>
      
      <ConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="Logout"
        description="Are you sure you want to log out of the admin panel?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="default"
        onConfirm={handleLogout}
      />
    </>
  );
}

