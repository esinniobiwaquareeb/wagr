"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import Link from "next/link";

function ResetPasswordContent() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validation
      if (!password || !confirmPassword) {
        setError("Please fill in all fields");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters long");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords don't match");
        setLoading(false);
        return;
      }

      // Note: Supabase handles the reset token via URL hash automatically
      // The hash parameter is set by Supabase when redirecting from email
      // We can update the password directly as Supabase validates the session
      
      // Update password using Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw new Error(updateError.message || "Failed to reset password");
      }

      setSuccess(true);
      
      toast({
        title: "Password reset successful!",
        description: "Your password has been updated. You can now log in with your new password.",
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/wagers?login=true");
      }, 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex-1 pb-24 md:pb-0 flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Password Reset Successful!</h1>
            <p className="text-muted-foreground mb-6">
              Your password has been updated. Redirecting to login...
            </p>
            <Link
              href="/wagers?login=true"
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="bg-card border border-border rounded-lg p-6 md:p-8">
          <div className="mb-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Reset Your Password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Must be at least 6 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <div className="text-center">
              <Link
                href="/wagers?login=true"
                className="text-sm text-primary hover:underline"
              >
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="flex-1 pb-24 md:pb-0 flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

