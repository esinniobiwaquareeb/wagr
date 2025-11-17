import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ConditionalNav } from "@/components/conditional-nav";
import { PWAInstaller } from "@/components/pwa-installer";
import { Toaster } from "@/components/ui/toaster";
import './globals.css'

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wagr.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'wagr - Wagering Platform | Join and Create Wagers',
    template: '%s | wagr'
  },
  description: 'Join and create wagers in real-time. Wager on sports, finance, politics, entertainment, and more. Transparent wagering platform with real-time updates.',
  keywords: ['wagering', 'wagers', 'sports wagering', 'finance wagering', 'politics wagering', 'real-time wagering', 'wagr'],
  authors: [{ name: 'wagr' }],
  creator: 'wagr',
  publisher: 'wagr',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.json',
  themeColor: '#A969A7',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'wagr',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'wagr',
    title: 'wagr - Wagering Platform | Join and Create Wagers',
    description: 'Join and create wagers in real-time. Wager on sports, finance, politics, entertainment, and more.',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'wagr - Wagering Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'wagr - Wagering Platform',
    description: 'Join and create wagers in real-time. Wager on sports, finance, politics, and more.',
    images: [`${siteUrl}/og-image.png`],
    creator: '@wagr',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification codes here
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // yahoo: 'your-yahoo-verification-code',
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'entertainment',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="theme-color" content="#A969A7" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="wagr" />
        <meta name="application-name" content="wagr" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#A969A7" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "wagr",
              "description": "Join and create wagers in real-time. Wager on sports, finance, politics, entertainment, and more.",
              "url": siteUrl,
              "applicationCategory": "EntertainmentApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.5",
                "ratingCount": "100"
              }
            })
          }}
        />
      </head>
      <body className={`${geist.className} antialiased`}>
        <ConditionalNav>
          {children}
        </ConditionalNav>
        <Toaster />
        <PWAInstaller />
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && typeof window !== 'undefined') {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(registration) {
                      // Service worker registered successfully
                    })
                    .catch(function(err) {
                      // Service worker registration failed
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
