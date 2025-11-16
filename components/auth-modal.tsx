"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { TwoFactorVerify } from "@/components/two-factor-verify";
import { markSessionAs2FAVerified } from "@/lib/session-2fa";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate email
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError("We need your email address to continue");
        setIsLoading(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError("That doesn't look like a valid email address");
        setIsLoading(false);
        return;
      }

      // Validate password
      if (!password) {
        setError("Password is required");
        setIsLoading(false);
        return;
      }

      if (isSignUp) {
        // Password strength validation for sign up
        if (password.length < 6) {
          setError("Your password needs to be at least 6 characters");
          setIsLoading(false);
          return;
        }

        if (password.length > 72) {
          setError("Your password is too long (max 72 characters)");
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`,
          },
        });
        if (error) throw error;
        setEmail("");
        setPassword("");
        toast({
          title: "You're all set!",
          description: "Check your email to confirm your account and get started.",
        });
      } else {
        // Login validation
        if (password.length < 1) {
          setError("Password is required");
          setIsLoading(false);
          return;
        }

        // Use the new login API that supports 2FA
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: trimmedEmail,
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
          setIsLoading(false);
          return;
        }

        // Check if user is an admin - admins should use admin login
        if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", data.user.id)
            .single();

          if (profile?.is_admin) {
            // Sign out admin and redirect to admin login
            await supabase.auth.signOut();
            toast({
              title: "Admin login required",
              description: "Please use the admin login page to access your account.",
              variant: "destructive",
            });
            onClose();
            setTimeout(() => {
              router.push("/admin/login");
            }, 1500);
            return;
          }
          
          // Mark session as 2FA verified if 2FA was used (for users without 2FA, this won't be set)
          if (data.twoFactorVerified) {
            markSessionAs2FAVerified(data.user.id);
          }
        }

        // After successful login, the session is created server-side via cookies
        // We need to ensure the client reads the session and triggers auth state updates
        // Wait a bit for cookies to be set, then refresh session
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get session to sync cookies from server
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Get user to trigger auth state change listeners in all components
        const { data: userData } = await supabase.auth.getUser();
        
        // Mark session as 2FA verified if 2FA was used (for users without 2FA, this won't be set)
        if (data.twoFactorVerified && userData?.user) {
          markSessionAs2FAVerified(userData.user.id);
        }
        
        // Force router refresh to update server components
        router.refresh();
        
        // Close modal after a brief delay to allow UI to update
        setTimeout(() => {
          onClose();
        }, 300);
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (code: string, isBackupCode: boolean) => {
    setIsLoading(true);
    setError(null);

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

      // Check if user is an admin
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", data.user.id)
          .single();

        if (profile?.is_admin) {
          await supabase.auth.signOut();
          toast({
            title: "Admin Access Required",
            description: "Admins must use the admin login page. Redirecting...",
            variant: "destructive",
          });
          onClose();
          setTimeout(() => {
            router.push("/admin/login");
          }, 1500);
          return;
        }
      }

      // Mark session as 2FA verified if 2FA was used
      if (data.twoFactorVerified && data.user) {
        markSessionAs2FAVerified(data.user.id);
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
      
      // Close modal after a brief delay to allow UI to update
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Verification failed");
      throw error; // Re-throw so TwoFactorVerify can handle it
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Show 2FA verification dialog if required
  if (requires2FA) {
    return (
      <>
        <TwoFactorVerify
          isOpen={requires2FA}
          onVerify={handle2FAVerify}
        />
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg p-5 md:p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold">
            {isSignUp ? "Create Account" : "Login to wagr"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl md:text-2xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition active:scale-95 touch-manipulation"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              placeholder="••••••••"
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation text-base"
          >
            {isLoading ? "Loading..." : isSignUp ? "Sign Up" : "Login"}
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition active:scale-95 touch-manipulation"
        >
          {isSignUp
            ? "Already have an account? Login"
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
