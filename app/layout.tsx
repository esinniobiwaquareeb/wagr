import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { MobileNav } from "@/components/mobile-nav";
import { Toaster } from "@/components/ui/toaster";
import './globals.css'

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'wagr',
  description: 'Join and create wagers in real-time',
  generator: 'v0.app',
  manifest: '/manifest.json',
  themeColor: '#A969A7',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'wagr',
  },
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
        <meta name="theme-color" content="#A969A7" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="wagr" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className={`${geist.className} antialiased`}>
        <div className="flex flex-col md:flex-row min-h-screen">
          <div className="flex-1">{children}</div>
          <MobileNav />
        </div>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
