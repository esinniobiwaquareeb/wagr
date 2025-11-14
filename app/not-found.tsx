import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex-1 pb-20 md:pb-0 flex items-center justify-center min-h-screen">
      <div className="max-w-6xl mx-auto p-4 md:p-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}

