"use client";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background mt-auto lg:pb-0 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
        <p className="text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} wagr. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

