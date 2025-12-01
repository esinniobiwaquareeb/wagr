// Crypto wager generator
// Generates wagers based on cryptocurrency market data

export interface CryptoWagerTemplate {
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  deadline: string;
  category: string;
  tags: string[];
}

export function generateCryptoWagers(currentPrices: Record<string, number>): CryptoWagerTemplate[] {
  const wagers: CryptoWagerTemplate[] = [];
  const now = new Date();
  
  // Bitcoin price predictions
  const btcPrice = currentPrices.BTC || 0;
  if (btcPrice > 0) {
    const priceTargets = [
      { target: btcPrice * 1.1, days: 7, amount: 500 },
      { target: btcPrice * 1.2, days: 30, amount: 1000 },
      { target: btcPrice * 0.9, days: 7, amount: 500 },
    ];

    priceTargets.forEach(({ target, days, amount }) => {
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + days);
      // Set time to end of day (23:59:59) for clarity
      deadline.setHours(23, 59, 59, 999);
      
      // Format deadline with date and time
      const deadlineFormatted = deadline.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      wagers.push({
        title: `Will Bitcoin reach $${target.toLocaleString(undefined, { maximumFractionDigits: 0 })} by ${deadlineFormatted}?`,
        description: `Current BTC price: $${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        side_a: "Yes",
        side_b: "No",
        amount,
        deadline: deadline.toISOString(),
        category: "crypto",
        tags: ["bitcoin", "btc", "price-prediction"],
      });
    });
  }

  // Ethereum price predictions
  const ethPrice = currentPrices.ETH || 0;
  if (ethPrice > 0) {
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + 30);
    // Set time to end of day (23:59:59) for clarity
    deadline.setHours(23, 59, 59, 999);
    
    // Format deadline with date and time
    const deadlineFormatted = deadline.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    wagers.push({
      title: `Will Ethereum reach $${(ethPrice * 1.2).toLocaleString(undefined, { maximumFractionDigits: 0 })} by ${deadlineFormatted}?`,
      description: `Current ETH price: $${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      side_a: "Yes",
      side_b: "No",
      amount: 500,
      deadline: deadline.toISOString(),
      category: "crypto",
      tags: ["ethereum", "eth", "price-prediction"],
    });
  }

  return wagers;
}

