"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, Mail, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/client";

export default function AdminLogin() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const checkAdmin = async () => {
      try {
        const currentUser = await getCurrentUser(true); // Force refresh
        if (mounted && currentUser?.is_admin) {
          router.replace("/admin");
        }
      } catch (error) {
        // Silently fail - user just needs to login
        console.error("Error checking admin status:", error);
      }
    };

    // Small delay to avoid race conditions
    timeoutId = setTimeout(() => {
      checkAdmin();
    }, 100);
    
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
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

      // Use the admin login API endpoint
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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

      // Parse admin login response
      const adminData = apiResponse.data?.admin;

      if (adminData) {
        // Clear form
        setEmail("");
        setPassword("");
        
        // Trigger auth state update
        window.dispatchEvent(new Event('auth-state-changed'));
        
        // Force router refresh to update server components with new session
        router.refresh();
        
        // Small delay to ensure session cookie is set, then redirect
        setTimeout(() => {
          router.replace("/admin");
        }, 100);
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

