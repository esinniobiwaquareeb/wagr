import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wagered.app';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with wagered.app. Have a question or need help? We\'re here to assist you. Contact our support team.',
  openGraph: {
    title: 'Contact Us | wagered.app',
    description: 'Get in touch with wagered.app. Have a question or need help?',
    url: `${siteUrl}/contact`,
  },
};

export const contactPageSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Contact Us",
  "description": "Get in touch with wagered.app. Have a question or need help? We're here to assist you.",
  "url": `${siteUrl}/contact`,
  "mainEntity": {
    "@type": "Organization",
    "name": "wagered.app",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "support@wagered.app",
      "url": `${siteUrl}/contact`
    }
  }
};

