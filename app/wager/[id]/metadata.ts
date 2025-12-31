import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  // In a real implementation, you would fetch the wager data here
  // For now, we'll use a generic template
  const wagerId = params.id;

  return {
    title: `Wager Details`,
    description: 'View and join this wager on wagered.app',
    openGraph: {
      title: `Wager on wagered.app`,
      description: 'Join this wager and win big!',
      url: `${siteUrl}/wager/${wagerId}`,
      type: 'website',
      images: [
        {
          url: `${siteUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: 'wagered.app Wager',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Wager on wagered.app`,
      description: 'Join this wager and win big!',
      images: [`${siteUrl}/og-image.png`],
    },
  };
}

