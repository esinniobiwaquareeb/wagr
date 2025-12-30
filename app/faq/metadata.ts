import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description: 'Find answers to common questions about wagered.app, including how to create wagers, how winnings are calculated, platform fees, and more.',
  openGraph: {
    title: 'FAQ - Frequently Asked Questions | wagered.app',
    description: 'Find answers to common questions about wagered.app',
    url: `${siteUrl}/faq`,
  },
};

