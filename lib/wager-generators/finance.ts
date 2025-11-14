// Finance wager generator
// Generates wagers based on financial market data

export interface FinanceWagerTemplate {
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  deadline: string;
  category: string;
  tags: string[];
}

export function generateFinanceWagers(marketData: {
  stockIndices?: Record<string, number>;
  forexRates?: Record<string, number>;
}): FinanceWagerTemplate[] {
  const wagers: FinanceWagerTemplate[] = [];
  const now = new Date();
  
  // Stock market predictions
  if (marketData.stockIndices) {
    Object.entries(marketData.stockIndices).forEach(([index, value]) => {
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 30);
      
      const target = value * 1.05; // 5% increase
      
      wagers.push({
        title: `Will ${index} reach ${target.toLocaleString(undefined, { maximumFractionDigits: 0 })} by ${deadline.toLocaleDateString()}?`,
        description: `Current ${index}: ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        side_a: "Yes",
        side_b: "No",
        amount: 1000,
        deadline: deadline.toISOString(),
        category: "finance",
        tags: ["stocks", index.toLowerCase(), "market-prediction"],
      });
    });
  }

  // Forex predictions
  if (marketData.forexRates) {
    Object.entries(marketData.forexRates).forEach(([pair, rate]) => {
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 14);
      
      const target = rate * 1.02; // 2% change
      
      wagers.push({
        title: `Will ${pair} reach ${target.toFixed(4)} by ${deadline.toLocaleDateString()}?`,
        description: `Current ${pair} rate: ${rate.toFixed(4)}`,
        side_a: "Yes",
        side_b: "No",
        amount: 500,
        deadline: deadline.toISOString(),
        category: "finance",
        tags: ["forex", pair.toLowerCase(), "currency"],
      });
    });
  }

  return wagers;
}

