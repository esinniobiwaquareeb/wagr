import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wagered.app';

export interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": "Organization";
  "name": string;
  "url": string;
  "logo": string;
  "description"?: string;
  "contactPoint"?: {
    "@type": "ContactPoint";
    "contactType": string;
    "email"?: string;
    "url"?: string;
  };
  "sameAs"?: string[];
  "foundingDate"?: string;
  "founder"?: {
    "@type": "Organization" | "Person";
    "name": string;
  };
}

export interface SiteNavigationElement {
  "@context": "https://schema.org";
  "@type": "SiteNavigationElement";
  "name": string;
  "url": string;
}

export interface BreadcrumbList {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  "itemListElement": Array<{
    "@type": "ListItem";
    "position": number;
    "name": string;
    "item": string;
  }>;
}

export interface FAQPage {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  "mainEntity": Array<{
    "@type": "Question";
    "name": string;
    "acceptedAnswer": {
      "@type": "Answer";
      "text": string;
    };
  }>;
}

export interface ContactPage {
  "@context": "https://schema.org";
  "@type": "ContactPage";
  "name": string;
  "description": string;
  "url": string;
}

export interface AboutPage {
  "@context": "https://schema.org";
  "@type": "AboutPage";
  "name": string;
  "description": string;
  "url": string;
}

export function getOrganizationSchema(): OrganizationSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "wagered.app",
    "url": siteUrl,
    "logo": `${siteUrl}/logo.png`,
    "description": "A modern wagering platform that allows users to create and participate in wagers on various topics, from sports and entertainment to finance and politics.",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "url": `${siteUrl}/contact`,
      "email": "support@wagered.app"
    },
    "sameAs": [
      // Add social media links when available
      // Example:
      // "https://twitter.com/wageredapp",
      // "https://facebook.com/wageredapp",
      // "https://instagram.com/wageredapp",
      // "https://linkedin.com/company/wageredapp"
    ],
    "foundingDate": "2024",
    "founder": {
      "@type": "Organization",
      "name": "wagered.app"
    }
  };
}

export function getSiteNavigationSchema(): SiteNavigationElement[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      "name": "Wagers",
      "url": `${siteUrl}/wagers`
    },
    {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      "name": "Leaderboard",
      "url": `${siteUrl}/leaderboard`
    },
    {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      "name": "About",
      "url": `${siteUrl}/about`
    },
    {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      "name": "Contact",
      "url": `${siteUrl}/contact`
    },
    {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      "name": "FAQ",
      "url": `${siteUrl}/faq`
    },
    {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      "name": "Terms",
      "url": `${siteUrl}/terms`
    },
    {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      "name": "Privacy",
      "url": `${siteUrl}/privacy`
    }
  ];
}

export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>): BreadcrumbList {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
}

export function StructuredData({ data }: { data: object | object[] }) {
  const jsonLd = Array.isArray(data) ? data : [data];
  
  return (
    <>
      {jsonLd.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}

