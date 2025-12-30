import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Read the Terms & Conditions for wagered.app. Understand the rules, regulations, and guidelines for using our wagering platform.',
  openGraph: {
    title: 'Terms & Conditions | wagered.app',
    description: 'Read the Terms & Conditions for wagered.app',
    url: `${siteUrl}/terms`,
  },
};

