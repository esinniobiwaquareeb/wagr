"use client";

import { useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function CreateWager() {
  const router = useRouter();
  const { loading } = useAuth({ 
    requireAuth: false
  });

  // Redirect to wagers page where users can use the modal
  useEffect(() => {
    if (!loading) {
      router.replace('/wagers');
    }
  }, [loading, router]);

  // Show loading spinner while redirecting
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto p-4 py-12">
        <LoadingSpinner size="lg" text="Redirecting..." />
      </div>
    </main>
  );
}
