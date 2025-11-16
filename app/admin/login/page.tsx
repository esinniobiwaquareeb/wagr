"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { TwoFactorVerify } from "@/components/two-factor-verify";
import { markSessionAs2FAVerified } from "@/lib/session-2fa";

export default function AdminLogin() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [requires2FA, setRequires2FA] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", currentUser.id)
          .single();

        if (profile?.is_admin) {
          router.push("/admin");
        } else {
          setUser(null);
        }
      }
    };

    checkAdmin();
  }, [supabase, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      if (!email.trim()) {
        toast({
          title: "Email required",
          description: "Please enter your email address.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        toast({
          title: "Invalid email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!password) {
        toast({
          title: "Password required",
          description: "Please enter your password.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Use the login API that supports 2FA
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error) {
          throw new Error(data.error.message || 'Login failed');
        }
        throw new Error('Login failed');
      }

      // Check if 2FA is required
      if (data.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Check if user is admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", data.user.id)
          .single();

        if (!profile?.is_admin) {
          await supabase.auth.signOut();
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // After successful login, the session is created server-side via cookies
        // We need to ensure the client reads the session and triggers auth state updates
        // Wait a bit for cookies to be set, then refresh session
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get session to sync cookies from server
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Get user to trigger auth state change listeners in all components
        const { data: userData } = await supabase.auth.getUser();
        
        // Mark session as 2FA verified if 2FA was used (for admins without 2FA, this won't be set)
        if (data.twoFactorVerified && userData?.user) {
          markSessionAs2FAVerified(userData.user.id);
        }
        
        // Force router refresh to update server components
        router.refresh();
        
        // Redirect after a brief delay to allow UI to update
        setTimeout(() => {
          router.push("/admin");
        }, 300);
      }
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error 
        ? (error.message || "An unexpected error occurred")
        : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message) || "An unexpected error occurred"
        : "Failed to log in. Please try again.";
      
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (code: string, isBackupCode: boolean) => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          twoFactorCode: code,
          isBackupCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error) {
          throw new Error(data.error.message || 'Verification failed');
        }
        throw new Error('Verification failed');
      }

      if (data.user) {
        // Check if user is admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", data.user.id)
          .single();

        if (!profile?.is_admin) {
          await supabase.auth.signOut();
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // After successful 2FA login, the session is created server-side via cookies
        // We need to ensure the client reads the session and triggers auth state updates
        // Wait a bit for cookies to be set, then refresh session
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get session to sync cookies from server
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Get user to trigger auth state change listeners in all components
        const { data: userData } = await supabase.auth.getUser();
        
        // Mark session as 2FA verified if 2FA was used
        if (data.twoFactorVerified && userData?.user) {
          markSessionAs2FAVerified(userData.user.id);
        }
        
        setRequires2FA(false);
        
        // Force router refresh to update server components
        router.refresh();
        
        // Redirect after a brief delay to allow UI to update
        setTimeout(() => {
          router.push("/admin");
        }, 300);
      }
    } catch (error) {
      console.error("2FA verification error:", error);
      const errorMessage = error instanceof Error 
        ? (error.message || "Verification failed")
        : "Failed to verify code. Please try again.";
      
      toast({
        title: "Verification failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error; // Re-throw so TwoFactorVerify can handle it
    } finally {
      setLoading(false);
    }
  };

  // Show 2FA verification dialog if required
  if (requires2FA) {
    return (
      <TwoFactorVerify
        isOpen={requires2FA}
        onVerify={handle2FAVerify}
      />
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border-2 border-border rounded-xl shadow-xl p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Access the admin control center</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Lock className="h-4 w-4" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98] touch-manipulation"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-border text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              ← Back to main app
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

