"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background mt-auto lg:pb-0 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground text-center md:text-left">
            © 2025 iwagr. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs text-muted-foreground">
            <Link 
              href="/terms" 
              className="hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link 
              href="/privacy" 
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link 
              href="/about" 
              className="hover:text-foreground transition-colors"
            >
              About
            </Link>
            <Link 
              href="/contact" 
              className="hover:text-foreground transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

