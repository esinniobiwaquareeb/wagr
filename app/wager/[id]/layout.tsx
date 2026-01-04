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

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[generateMetadata] Response:', {
        hasResponse: !!response,
        success: response?.success,
        hasData: !!response?.data,
        hasWager: !!response?.data?.wager,
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response?.data ? Object.keys(response.data) : [],
        wagerId,
        error: response?.error,
      });
    }

    // Check response structure - backend returns { success: true, data: { wager } }
    // nestjsServerFetch returns the full response object
    if (!response || !response.success) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[generateMetadata] API call failed:', {
          success: response?.success,
          error: response?.error,
          wagerId,
        });
      }
      // Fallback to generic metadata if API call failed
      return {
        title: 'Wager Details',
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

    // Check if wager exists in response
    const wager = response.data?.wager || (response.data as any)?.wager;
    
    if (!wager) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[generateMetadata] Wager not found in response:', {
          responseStructure: response,
          dataStructure: response.data,
          wagerId,
        });
      }
      // Fallback to generic metadata if wager not found
      return {
        title: 'Wager Details',
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

    // Type assertion for wager data
    const wagerData: WagerData = wager as WagerData;
    
    // Validate required fields
    if (!wagerData.title || !wagerData.side_a || !wagerData.side_b) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[generateMetadata] Wager data incomplete:', {
          hasTitle: !!wagerData.title,
          hasSideA: !!wagerData.side_a,
          hasSideB: !!wagerData.side_b,
          wagerData,
        });
      }
      // Fallback to generic metadata if wager data is incomplete
      return {
        title: 'Wager Details',
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
    
    // Calculate pool size
    const sideATotal = wagerData.entries?.sideA?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
    const sideBTotal = wagerData.entries?.sideB?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
    const totalPot = sideATotal + sideBTotal;
    const totalParticipants = (wagerData.entries?.sideA?.length || 0) + (wagerData.entries?.sideB?.length || 0);
    
    // Build description
    const currency = wagerData.currency || 'NGN';
    const poolSize = formatVolume(totalPot);
    const entryAmount = formatCurrency(wagerData.amount, currency);
    
    let description = `${wagerData.side_a} vs ${wagerData.side_b}`;
    if (wagerData.description) {
      description = `${wagerData.description.substring(0, 100)}${wagerData.description.length > 100 ? '...' : ''}`;
    }
    
    // Enhanced description with stats
    const statsDescription = `${description} • ${poolSize} pool • ${totalParticipants} ${totalParticipants === 1 ? 'participant' : 'participants'} • ${entryAmount}/wager`;
    
    // Build title - root layout has template '%s | wagered.app', so just return the wager title
    const pageTitle = wagerData.title;
    
    // Build category info
    const categoryLabel = typeof wagerData.category === 'object' 
      ? (wagerData.category?.label || wagerData.category?.slug || 'Wager')
      : (wagerData.category || 'Wager');
    
    // Status indicator
    const statusText = wagerData.status === 'OPEN' ? 'Live' : wagerData.status === 'SETTLED' ? 'Settled' : 'Resolved';
    
    // Build Open Graph description
    const ogDescription = `${wagerData.side_a} vs ${wagerData.side_b} • ${poolSize} pool • ${totalParticipants} ${totalParticipants === 1 ? 'participant' : 'participants'} • ${entryAmount} per wager • ${statusText}`;
    
    // Use short_id if available for cleaner URLs
    const shareId = wagerData.short_id || wagerData.id;
    const wagerUrl = `${siteUrl}/wager/${shareId}`;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[generateMetadata] Successfully generated metadata:', {
        title: pageTitle,
        description: statsDescription.substring(0, 50),
        wagerId,
      });
    }
    
    return {
      title: pageTitle,
      description: statsDescription,
      keywords: [
        'wager',
        'wager',
        'prediction',
        'market',
        categoryLabel.toLowerCase(),
        wagerData.side_a.toLowerCase(),
        wagerData.side_b.toLowerCase(),
        'wagered.app',
        'prediction market',
        'wagering',
      ].filter(Boolean).join(', '),
      openGraph: {
        title: wagerData.title,
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
            alt: `${wagerData.title} - ${wagerData.side_a} vs ${wagerData.side_b} on ${siteName}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: wagerData.title,
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
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[generateMetadata] Error fetching wager metadata:', error);
    }
    
    // Fallback to generic metadata on error
    // Root layout has template '%s | wagered.app', so just return the title
    return {
      title: 'Wager Details',
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

export default function WagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

