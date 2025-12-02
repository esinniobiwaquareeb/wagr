"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { TwoFactorVerify } from "@/components/two-factor-verify";
import { markSessionAs2FAVerified } from "@/lib/session-2fa";
import { authCache } from "@/lib/auth/cache";
import { Eye, EyeOff } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [username, setUsername] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Check if user just verified their email
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('verified') === 'true') {
        setVerificationSuccess(true);
        // Remove the query parameter
        urlParams.delete('verified');
        const newUrl = urlParams.toString() 
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname;
        router.replace(newUrl);
      }
    }
  }, [isOpen, router]);

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
        // Validate username for sign up
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
          setError("Username is required");
          setIsLoading(false);
          return;
        }

        if (trimmedUsername.length < 3) {
          setError("Username must be at least 3 characters long");
          setIsLoading(false);
          return;
        }

        if (trimmedUsername.length > 30) {
          setError("Username must be less than 30 characters");
          setIsLoading(false);
          return;
        }

        // Validate username format (must match server rules)
        // Allowed characters: letters, numbers, underscores, and hyphens
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!usernameRegex.test(trimmedUsername)) {
          setError("Username can only contain letters, numbers, underscores, and hyphens");
          setIsLoading(false);
          return;
        }

        // Password strength validation for sign up
        // Get min password length from settings (defaults to 8)
        // We'll validate on frontend with 6 as minimum, but backend will enforce the actual setting
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

        // Register using custom auth API
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
            username: trimmedUsername,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          const { extractErrorFromResponse } = await import('@/lib/error-extractor');
          const errorMessage = await extractErrorFromResponse(response, 'Registration failed, please try again.');
          throw new Error(errorMessage);
        }

        // Show success message in modal - user is NOT logged in
        // They must verify email first, then login
        setRegistrationSuccess(true);
        setEmail("");
        setPassword("");
        setUsername("");
        setIsLoading(false);
        
        // DO NOT clear auth cache or trigger auth state change
        // User is not logged in - they need to verify email and then login
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
            rememberMe,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          // Extract error message from the already-parsed data
          const errorMessage = data?.error?.message || data?.message || 'Login failed, please try again.';
          throw new Error(errorMessage);
        }

        // Check if 2FA is required (new API format: data.data.requires2FA)
        if (data.data?.requires2FA) {
          setRequires2FA(true);
          setIsLoading(false);
          return;
        }

        // Mark session as 2FA verified if 2FA was used
        if (data.data?.twoFactorVerified && data.data?.user) {
          markSessionAs2FAVerified(data.data.user.id);
        }
        
        // Clear auth cache and trigger auth state change event FIRST to update UI immediately
        authCache.clear();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-state-changed'));
        }
        
        // Force router refresh to update server components
        router.refresh();
        
        // Close modal after a brief delay to allow UI to update
        setTimeout(() => {
          onClose();
        }, 100);
      }
    } catch (error: unknown) {
      const { extractErrorMessage } = await import('@/lib/error-extractor');
      const errorMessage = extractErrorMessage(error, "Something went wrong. Please try again.");
      setError(errorMessage);
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
          rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const { extractErrorFromResponse } = await import('@/lib/error-extractor');
        const errorMessage = await extractErrorFromResponse(response, 'Verification failed, please try again.');
        throw new Error(errorMessage);
      }

      // Mark session as 2FA verified if 2FA was used (new API format: data.data)
      if (data.data?.twoFactorVerified && data.data?.user) {
        markSessionAs2FAVerified(data.data.user.id);
      }
      
      setRequires2FA(false);
      
      // Trigger auth state change event FIRST to update UI immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-state-changed'));
      }
      
      // Force router refresh to update server components
      router.refresh();
      
      // Close modal after a brief delay
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Verification failed");
      throw error; // Re-throw so TwoFactorVerify can handle it
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setError(null);

    try {
      const trimmedEmail = forgotPasswordEmail.trim();
      if (!trimmedEmail) {
        setError("Please enter your email address");
        setForgotPasswordLoading(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError("Please enter a valid email address");
        setForgotPasswordLoading(false);
        return;
      }

      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to send password reset email');
      }

      setForgotPasswordSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  if (!isOpen) return null;

  // Show verification success message
  if (verificationSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card rounded-lg p-5 md:p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-5 md:mb-6">
            <h2 className="text-lg md:text-xl font-bold">Email Verified!</h2>
            <button
              onClick={() => {
                setVerificationSuccess(false);
                onClose();
              }}
              className="text-muted-foreground hover:text-foreground text-xl md:text-2xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition active:scale-95 touch-manipulation"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm">
              <p className="font-medium mb-1">Verification successful!</p>
              <p>Your email has been verified. You can now log in to your account.</p>
            </div>
            <button
              onClick={() => {
                setVerificationSuccess(false);
                onClose();
              }}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation text-base"
            >
              Continue to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show registration success message
  if (registrationSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card rounded-lg p-5 md:p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-5 md:mb-6">
            <h2 className="text-lg md:text-xl font-bold">Registration Successful!</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xl md:text-2xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition active:scale-95 touch-manipulation"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm">
              <p className="font-medium mb-1">Check your email</p>
              <p>We've sent a verification link to your email address. Please click the link to verify your account and get started.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation text-base"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => {
        setShowForgotPassword(false);
        setForgotPasswordEmail("");
        setForgotPasswordSent(false);
        setError(null);
      }}>
        <div className="bg-card rounded-lg p-5 md:p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-5 md:mb-6">
            <h2 className="text-lg md:text-xl font-bold">Reset Password</h2>
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setForgotPasswordEmail("");
                setForgotPasswordSent(false);
                setError(null);
              }}
              className="text-muted-foreground hover:text-foreground text-xl md:text-2xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition active:scale-95 touch-manipulation"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {forgotPasswordSent ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm">
                <p className="font-medium mb-1">Check your email</p>
                <p>If an account with that email exists, we've sent you a password reset link.</p>
              </div>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordEmail("");
                  setForgotPasswordSent(false);
                  setError(null);
                }}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation text-base"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotPasswordLoading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation text-base"
              >
                {forgotPasswordLoading ? "Sending..." : "Send Reset Link"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordEmail("");
                  setError(null);
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition active:scale-95 touch-manipulation"
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

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
            {isSignUp ? "Create Account" : "Login to wagered.app"}
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
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                placeholder="Choose a username"
                autoComplete="username"
                minLength={3}
                maxLength={30}
              />
            </div>
          )}
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
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-10 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                placeholder="••••••••"
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {!isSignUp && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/50 cursor-pointer"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-muted-foreground cursor-pointer select-none"
              >
                Remember me
              </label>
            </div>
          )}

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

          <div className="mt-4 space-y-2">
            {!isSignUp && (
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                }}
                className="w-full text-sm text-primary hover:underline transition"
              >
                Forgot password?
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition active:scale-95 touch-manipulation"
            >
              {isSignUp
                ? "Already have an account? Login"
                : "Don't have an account? Sign up"}
            </button>
          </div>
      </div>
    </div>
  );
}
