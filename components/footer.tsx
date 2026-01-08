"use client";

import Link from "next/link";
import { useNavAuth } from "@/hooks/use-nav-auth";

export function Footer() {
  const { user } = useNavAuth();
  const isAuthenticated = !!user;

  const quickLinks = [
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQs" },
    { href: "/help", label: "Help Center" },
    { href: "/contact", label: "Contact" },
  ];

  const legalLinks = [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/legal", label: "Legal" },
    { href: "/legal/prohibition", label: "Prohibition Policies" },
    { href: "/legal/dispute-resolution", label: "Dispute Resolution" },
  ];

  return (
    <footer className={`border-t border-border/50 bg-background mt-auto lg:pb-0 pb-20 ${isAuthenticated ? 'hidden lg:block' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Legal</h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform Info */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Platform</h3>
            <ul className="space-y-2">
              <li>
                <p className="text-xs text-muted-foreground">
                  Prediction market and trading platform
                </p>
              </li>
              <li>
                <p className="text-xs text-muted-foreground">
                  Not a betting or gambling platform
                </p>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/help"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  FAQs
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/dispute-resolution"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dispute Resolution
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border/50 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground text-center md:text-left">
              © 2025 wagered.app. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground text-center md:text-right">
              Prediction market and trading platform. Not a betting or gambling platform.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

