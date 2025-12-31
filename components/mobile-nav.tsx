"use client";

import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { useState } from "react";
import { Home, Plus, Wallet, Trophy, User, Bell, Gift } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CreateWagerModal } from "@/components/create-wager-modal";
import { useNavAuth } from "@/hooks/use-nav-auth";

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, unreadCount, handleLogout } = useNavAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Mobile Navigation - Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border lg:hidden z-50 safe-area-inset-bottom shadow-lg">
        <div className="flex justify-around items-center h-20 px-1">
          <Link
            href="/wagers"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isActive("/wagers")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Wagers"
          >
            <Home className={`h-5 w-5 transition-transform mb-0.5 ${isActive("/wagers") ? "scale-110" : ""}`} />
            <span className="text-[9px] font-medium leading-tight text-center">Wagers</span>
          </Link>
          
          <Link
            href="/leaderboard"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isActive("/leaderboard")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Leaderboard"
          >
            <Trophy className={`h-5 w-5 transition-transform mb-0.5 ${isActive("/leaderboard") ? "scale-110" : ""}`} />
            <span className="text-[9px] font-medium leading-tight text-center">Top</span>
          </Link>

          {/* Floating Create Button */}
          <button
            onClick={() => {
              if (user) {
                setShowCreateModal(true);
              } else {
                setShowAuthModal(true);
              }
            }}
            className="relative flex items-center justify-center w-14 h-14 -mt-4 rounded-full shadow-lg transition-all duration-300 active:scale-95 touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[56px] bg-primary text-primary-foreground hover:shadow-xl hover:scale-105"
            title={user ? "Create Wager" : "Login to Create Wager"}
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>

          <Link
            href="/wallet"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isActive("/wallet")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Wallet"
          >
            <Wallet className={`h-5 w-5 transition-transform mb-0.5 ${isActive("/wallet") ? "scale-110" : ""}`} />
            <span className="text-[9px] font-medium leading-tight text-center">Wallet</span>
          </Link>

          {user ? (
            <Link
              href="/profile"
              className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                isActive("/profile")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Profile"
            >
              <User className={`h-5 w-5 transition-transform mb-0.5 ${isActive("/profile") ? "scale-110" : ""}`} />
              <span className="text-[9px] font-medium leading-tight text-center">Profile</span>
            </Link>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex flex-col items-center justify-center flex-1 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 min-w-0 min-h-[44px] touch-manipulation active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50"
              title="Login"
            >
              <User className="h-5 w-5 mb-0.5" />
              <span className="text-[9px] font-medium leading-tight text-center">Login</span>
            </button>
          )}
        </div>
      </nav>

      {/* Floating Notification Button - Mobile Only */}
      {user && (
        <Link
          href="/notifications"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={`fixed bottom-28 right-4 lg:hidden z-[60] w-14 h-14 rounded-full shadow-xl transition-all duration-300 active:scale-95 touch-manipulation flex items-center justify-center pointer-events-auto ${
            isActive("/notifications")
              ? "bg-primary text-primary-foreground shadow-primary/50"
              : "bg-card border-2 border-primary/30 text-foreground hover:border-primary hover:shadow-2xl hover:scale-105"
          }`}
          title="Notifications"
          aria-label="View notifications"
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center min-w-[24px] leading-none border-2 border-background shadow-lg">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="Logout"
        description="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="default"
        onConfirm={handleLogout}
      />
      <CreateWagerModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          router.push('/wagers');
        }}
      />
    </>
  );
}
