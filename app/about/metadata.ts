import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';

export const metadata: Metadata = {
  title: 'About wagered.app',
  description: 'Learn about wagered.app - a modern wagering platform that allows users to create and participate in wagers on sports, finance, politics, and entertainment.',
  openGraph: {
    title: 'About wagered.app | Wagering Platform',
    description: 'Learn about wagered.app - a modern wagering platform for sports, finance, politics, and entertainment.',
    url: `${siteUrl}/about`,
  },
};

export const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About wagered.app",
  "description": "wagered.app is a modern wagering platform that allows users to create and participate in wagers on various topics, from sports and entertainment to finance and politics.",
  "url": `${siteUrl}/about`,
  "mainEntity": {
    "@type": "Organization",
    "name": "wagered.app",
    "description": "A modern wagering platform for sports, finance, politics, and entertainment"
  }
};

