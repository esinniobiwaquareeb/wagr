"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

const PWA_DISMISSED_KEY = 'pwa-install-dismissed';
const PWA_DISMISSED_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Check if app is already installed
  const isInstalled = () => {
    // Check if running in standalone mode (installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    
    // Check if running as a web app on iOS
    if ((window.navigator as any).standalone === true) {
      return true;
    }
    
    // Check if user has dismissed the prompt recently
    const dismissedTimestamp = localStorage.getItem(PWA_DISMISSED_KEY);
    if (dismissedTimestamp) {
      const dismissedTime = parseInt(dismissedTimestamp, 10);
      const now = Date.now();
      // If dismissed less than cooldown period ago, don't show
      if (now - dismissedTime < PWA_DISMISSED_COOLDOWN) {
        return true; // Treat as "installed" to prevent showing
      }
    }
    
    return false;
  };

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isInstalled()) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
      // Clear dismissed timestamp since user installed
      localStorage.removeItem(PWA_DISMISSED_KEY);
    } else {
      // User declined, store dismissal timestamp
      localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Store dismissal timestamp
    localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-card border border-border rounded-lg shadow-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Install iwagr</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Install iwagr for a better experience with offline support.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition active:scale-[0.98]"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition active:scale-[0.98]"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-muted-foreground hover:text-foreground transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

