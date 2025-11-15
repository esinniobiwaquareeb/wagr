"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Something went wrong!</h1>
            <p className="text-muted-foreground mb-6">
              A critical error occurred. Please refresh the page.
            </p>
            <button
              onClick={reset}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

