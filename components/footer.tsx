"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-lg font-bold mb-3">wagr</h3>
            <p className="text-sm text-muted-foreground">
              Join and create wagers. Pick a side and win!
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className={`text-sm text-muted-foreground hover:text-foreground transition ${
                    pathname === "/terms" ? "text-foreground font-medium" : ""
                  }`}
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className={`text-sm text-muted-foreground hover:text-foreground transition ${
                    pathname === "/privacy" ? "text-foreground font-medium" : ""
                  }`}
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Support</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className={`text-sm text-muted-foreground hover:text-foreground transition ${
                    pathname === "/about" ? "text-foreground font-medium" : ""
                  }`}
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className={`text-sm text-muted-foreground hover:text-foreground transition ${
                    pathname === "/contact" ? "text-foreground font-medium" : ""
                  }`}
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Resources</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/faq"
                  className={`text-sm text-muted-foreground hover:text-foreground transition ${
                    pathname === "/faq" ? "text-foreground font-medium" : ""
                  }`}
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/help"
                  className={`text-sm text-muted-foreground hover:text-foreground transition ${
                    pathname === "/help" ? "text-foreground font-medium" : ""
                  }`}
                >
                  Help Center
                </Link>
              </li>
            </ul>
          </div>
        </div> */}

        <div className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} wagr. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

