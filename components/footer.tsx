"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs md:text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} wagr. All rights reserved.
          </p>
          <div className="flex gap-4 md:gap-6 text-xs md:text-sm text-muted-foreground">
            <Link 
              href="/terms" 
              className="hover:text-foreground transition"
            >
              Terms
            </Link>
            <Link 
              href="/privacy" 
              className="hover:text-foreground transition"
            >
              Privacy
            </Link>
            <Link 
              href="/about" 
              className="hover:text-foreground transition"
            >
              About
            </Link>
            <Link 
              href="/contact" 
              className="hover:text-foreground transition"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

