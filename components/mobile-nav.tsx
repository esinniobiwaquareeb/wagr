"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { Home, Plus, Wallet, Trophy, User, Settings } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const getUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUser(data?.user || null);
      } catch (error) {
        console.error('Error getting user:', error);
        setUser(null);
      }
    };
    
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, [supabase]);


  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:static md:border-t-0 z-50">
      <div className="flex justify-around md:flex-col md:gap-2 md:p-4">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center flex-1 py-2 md:py-2 md:px-3 rounded-md transition ${
            isActive("/")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Wagers"
        >
          <Home className="h-5 w-5 md:h-4 md:w-4" />
          <span className="text-xs mt-1 md:mt-0 md:text-sm hidden md:inline">Wagers</span>
        </Link>
        <Link
          href="/create"
          className={`flex flex-col items-center justify-center flex-1 py-2 md:py-2 md:px-3 rounded-md transition ${
            isActive("/create")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Create"
        >
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
          <span className="text-xs mt-1 md:mt-0 md:text-sm hidden md:inline">Create</span>
        </Link>
        <Link
          href="/leaderboard"
          className={`flex flex-col items-center justify-center flex-1 py-2 md:py-2 md:px-3 rounded-md transition ${
            isActive("/leaderboard")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Leaderboard"
        >
          <Trophy className="h-5 w-5 md:h-4 md:w-4" />
          <span className="text-xs mt-1 md:mt-0 md:text-sm hidden md:inline">Leaderboard</span>
        </Link>
        <Link
          href="/wallet"
          className={`flex flex-col items-center justify-center flex-1 py-2 md:py-2 md:px-3 rounded-md transition ${
            isActive("/wallet")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Wallet"
        >
          <Wallet className="h-5 w-5 md:h-4 md:w-4" />
          <span className="text-xs mt-1 md:mt-0 md:text-sm hidden md:inline">Wallet</span>
        </Link>
        <Link
          href="/preferences"
          className={`flex flex-col items-center justify-center flex-1 py-2 md:py-2 md:px-3 rounded-md transition ${
            isActive("/preferences")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Preferences"
        >
          <Settings className="h-5 w-5 md:h-4 md:w-4" />
          <span className="text-xs mt-1 md:mt-0 md:text-sm hidden md:inline">Preferences</span>
        </Link>
        {user ? (
          <Link
            href="/profile"
            className={`flex flex-col items-center justify-center flex-1 py-2 md:py-2 md:px-3 rounded-md transition ${
              isActive("/profile")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Profile"
          >
            <User className="h-5 w-5 md:h-4 md:w-4" />
            <span className="text-xs mt-1 md:mt-0 md:text-sm hidden md:inline">Profile</span>
          </Link>
        ) : (
          <Link
            href="/"
            className="flex flex-col items-center justify-center flex-1 py-2 md:py-2 md:px-3 text-muted-foreground hover:text-foreground rounded-md transition"
            title="Login"
          >
            <User className="h-5 w-5 md:h-4 md:w-4" />
            <span className="text-xs mt-1 md:mt-0 md:text-sm hidden md:inline">Login</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
