"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, Mail, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { TwoFactorVerify } from "@/components/two-factor-verify";
import { getCurrentUser } from "@/lib/auth/client";

export default function AdminLogin() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const checkAdmin = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (mounted && currentUser?.is_admin) {
          router.push("/admin");
        }
      } catch (error) {
        console.error("Error checking admin status on login page:", error);
      }
    };

    checkAdmin();
    
    return () => {
      mounted = false;
    };
  }, [router]);

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

      const apiResponse = await response.json();

      if (!response.ok) {
        const errorMessage = apiResponse.error?.message || 'Login failed';
        throw new Error(errorMessage);
      }

      // Parse uniform API response format
      const userData = apiResponse.data?.user;
      const requires2FA = apiResponse.data?.requires2FA;

      // Check if 2FA is required
      if (requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (userData) {
        // Check if user is admin
        if (!userData.is_admin) {
          // Logout by clearing session
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Trigger auth state update
        window.dispatchEvent(new Event('auth-state-changed'));
        
        // Force router refresh
        router.refresh();
        
        // Redirect after a brief delay to allow UI to update
        setTimeout(() => {
          router.push("/admin");
        }, 300);
      }
    } catch (error) {
      console.error("Login error:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Failed to log in. Please try again.");
      
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

      const apiResponse = await response.json();

      if (!response.ok) {
        const errorMessage = apiResponse.error?.message || 'Verification failed';
        throw new Error(errorMessage);
      }

      // Parse uniform API response format
      const userData = apiResponse.data?.user;

      if (userData) {
        // Check if user is admin
        if (!userData.is_admin) {
          // Logout by clearing session
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        setRequires2FA(false);
        
        // Trigger auth state update
        window.dispatchEvent(new Event('auth-state-changed'));
        
        // Force router refresh
        router.refresh();
        
        // Redirect after a brief delay to allow UI to update
        setTimeout(() => {
          router.push("/admin");
        }, 300);
      }
    } catch (error) {
      console.error("2FA verification error:", error);
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Failed to verify code. Please try again.");
      
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
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

