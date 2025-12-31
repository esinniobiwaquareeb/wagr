import type { Metadata } from 'next';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';
const siteName = 'wagered.app';

interface WagerData {
  id: string;
  short_id?: string;
  title: string;
  description?: string;
  side_a: string;
  side_b: string;
  amount: number;
  currency?: string;
  status: string;
  deadline?: string;
  entries?: {
    sideA?: any[];
    sideB?: any[];
  };
  category?: {
    label?: string;
    slug?: string;
  } | string;
}

function formatCurrency(amount: number, currency: string = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatVolume(amount: number): string {
  if (amount >= 1000000) {
    return `₦${(amount / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  }
  if (amount >= 1000) {
    return `₦${(amount / 1000).toFixed(0)}k`;
  }
  return `₦${amount.toFixed(0)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: wagerId } = await params;
  
  try {
    // Fetch wager data server-side
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;
    
    // Backend returns: { success: true, data: { wager } }
    // nestjsServerFetch returns the full response: { success: true, data: { wager } }
    const response = await nestjsServerFetch<any>(`/wagers/${wagerId}`, {
      method: 'GET',
      token,
      requireAuth: false, // Public endpoint
    });

    // Check response structure - backend returns { success: true, data: { wager } }
    // nestjsServerFetch returns the full response object
    if (!response || !response.success || !response.data || !response.data.wager) {
      // Fallback to generic metadata if wager not found
      return {
        title: `Wager Details | ${siteName}`,
        description: 'View and join this wager on wagered.app',
        openGraph: {
          title: `Wager on ${siteName}`,
          description: 'Join this wager and win big!',
          url: `${siteUrl}/wager/${wagerId}`,
          type: 'website',
          siteName,
        },
        twitter: {
          card: 'summary_large_image',
          title: `Wager on ${siteName}`,
          description: 'Join this wager and win big!',
        },
      };
    }

    const wager = response.data.wager as WagerData;
    
    // Calculate pool size
    const sideATotal = wager.entries?.sideA?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
    const sideBTotal = wager.entries?.sideB?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
    const totalPot = sideATotal + sideBTotal;
    const totalParticipants = (wager.entries?.sideA?.length || 0) + (wager.entries?.sideB?.length || 0);
    
    // Build description
    const currency = wager.currency || 'NGN';
    const poolSize = formatVolume(totalPot);
    const entryAmount = formatCurrency(wager.amount, currency);
    
    let description = `${wager.side_a} vs ${wager.side_b}`;
    if (wager.description) {
      description = `${wager.description.substring(0, 100)}${wager.description.length > 100 ? '...' : ''}`;
    }
    
    // Enhanced description with stats
    const statsDescription = `${description} • ${poolSize} pool • ${totalParticipants} ${totalParticipants === 1 ? 'bettor' : 'bettors'} • ${entryAmount}/bet`;
    
    // Build title - root layout has template '%s | wagered.app', so just return the wager title
    const pageTitle = wager.title;
    
    // Build category info
    const categoryLabel = typeof wager.category === 'object' 
      ? (wager.category?.label || wager.category?.slug || 'Wager')
      : (wager.category || 'Wager');
    
    // Status indicator
    const statusText = wager.status === 'OPEN' ? 'Live' : wager.status === 'SETTLED' ? 'Settled' : 'Resolved';
    
    // Build Open Graph description
    const ogDescription = `${wager.side_a} vs ${wager.side_b} • ${poolSize} pool • ${totalParticipants} ${totalParticipants === 1 ? 'bettor' : 'bettors'} • ${entryAmount} per bet • ${statusText}`;
    
    // Use short_id if available for cleaner URLs
    const shareId = wager.short_id || wager.id;
    const wagerUrl = `${siteUrl}/wager/${shareId}`;
    
    return {
      title: pageTitle,
      description: statsDescription,
      keywords: [
        'wager',
        'bet',
        'prediction',
        'market',
        categoryLabel.toLowerCase(),
        wager.side_a.toLowerCase(),
        wager.side_b.toLowerCase(),
        'wagered.app',
        'prediction market',
        'betting',
      ].filter(Boolean).join(', '),
      openGraph: {
        title: wager.title,
        description: ogDescription,
        url: wagerUrl,
        type: 'website',
        siteName,
        locale: 'en_US',
        images: [
          {
            url: `${siteUrl}/og-image.png`,
            width: 1200,
            height: 630,
            alt: `${wager.title} - ${wager.side_a} vs ${wager.side_b} on ${siteName}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: wager.title,
        description: ogDescription,
        images: [
          `${siteUrl}/og-image.png`,
        ],
      },
      alternates: {
        canonical: wagerUrl,
      },
      other: {
        'og:type': 'website',
        'og:site_name': siteName,
      },
    };
  } catch (error) {
    // Fallback to generic metadata on error
    return {
      title: `Wager Details | ${siteName}`,
      description: 'View and join this wager on wagered.app',
      openGraph: {
        title: `Wager on ${siteName}`,
        description: 'Join this wager and win big!',
        url: `${siteUrl}/wager/${wagerId}`,
        type: 'website',
        siteName,
      },
      twitter: {
        card: 'summary_large_image',
        title: `Wager on ${siteName}`,
        description: 'Join this wager and win big!',
      },
    };
  }
}

