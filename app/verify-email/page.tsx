"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. Please check your email and try again.');
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
          method: 'GET',
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus('error');
          setMessage(data.error?.message || 'Verification failed. Please try again.');
          return;
        }

        if (data.alreadyVerified) {
          setStatus('success');
          setMessage('Your email is already verified. You can now log in.');
        } else {
          setStatus('success');
          setMessage('Email verified successfully! Welcome to wagr!');
        }

        // If session was created, auto-login by refreshing and redirecting
        if (data.hasSession) {
          toast({
            title: "Email verified!",
            description: "Your account has been verified. Logging you in...",
          });
          
          // Refresh to update auth state
          router.refresh();
          
          // Trigger auth state change
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth-state-changed'));
          }
          
          // Redirect to wagers page after a short delay
          setTimeout(() => {
            router.push('/wagers');
          }, 1000);
        } else {
          toast({
            title: "Email verified!",
            description: "Your account has been verified. You can now log in.",
          });

          // Redirect to login with success message after 2 seconds
          setTimeout(() => {
            router.push('/wagers?login=true&verified=true');
          }, 2000);
        }
      } catch (error) {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
        console.error('Error verifying email:', error);
      }
    };

    verifyEmail();
  }, [searchParams, router, toast]);

  return (
    <main className="flex-1 pb-24 md:pb-0 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="mb-4 flex justify-center">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Verifying Email...</h1>
              <p className="text-muted-foreground">
                Please wait while we verify your email address.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Email Verified!</h1>
              <p className="text-muted-foreground mb-6">
                {message}
              </p>
              <Link
                href="/wagers?login=true"
                className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
              >
                Go to Login
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
              <p className="text-muted-foreground mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <Link
                  href="/wagers?login=true"
                  className="inline-block w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
                >
                  Go to Login
                </Link>
                <button
                  onClick={() => router.push('/wagers?login=true')}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Request new verification email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <main className="flex-1 pb-24 md:pb-0 flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

