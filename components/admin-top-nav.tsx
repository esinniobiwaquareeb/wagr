"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdmin } from "@/contexts/admin-context";
import { 
  User, 
  Settings, 
  LogOut, 
  Shield, 
  ChevronDown,
  Bell,
  Search
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { adminLogout } from "@/lib/auth/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

export function AdminTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { admin } = useAdmin();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = async () => {
    try {
      await adminLogout();
      window.dispatchEvent(new Event('auth-state-changed'));
      window.location.href = '/admin/login';
    } catch (error) {
      logger.error('Admin logout error', error);
      window.location.href = '/admin/login';
    }
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'A';
  };

  const getRoleBadgeColor = (role?: string | null) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'moderator':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  if (!admin) return null;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          {/* Left side - Breadcrumb or title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm md:text-base">Admin Center</span>
            </div>
          </div>

          {/* Right side - Profile dropdown */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 h-auto py-1.5 px-2 hover:bg-muted"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={undefined} alt={admin.full_name || admin.username || admin.email} />
                    <AvatarFallback className="text-xs">
                      {getInitials(admin.full_name, admin.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium">
                      {admin.full_name || admin.username || admin.email}
                    </span>
                    {admin.role && (
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", getRoleBadgeColor(admin.role))}>
                        {admin.role.replace('_', ' ').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {admin.full_name || admin.username || 'Admin'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {admin.email}
                    </p>
                    {admin.role && (
                      <span className={cn("text-xs px-1.5 py-0.5 rounded mt-1 inline-block w-fit", getRoleBadgeColor(admin.role))}>
                        {admin.role.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/admin/account')}>
                  <User className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Platform Settings
                </DropdownMenuItem>
                {admin.permissions?.includes('manage_admins') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/admin/admins')}>
                      <Shield className="mr-2 h-4 w-4" />
                      Manage Admins
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowLogoutDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

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

