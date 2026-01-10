export type Currency = "NGN" | "USD" | "EUR" | "GBP";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  NGN: "₦",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const DEFAULT_CURRENCY: Currency = "NGN";

/**
 * Format currency amount with symbol
 * @param amount - Amount to format
 * @param currency - Currency code (defaults to NGN)
 * @param symbol - Optional custom symbol (overrides currency symbol)
 */
export function formatCurrency(
  amount: number, 
  currency: Currency | string = DEFAULT_CURRENCY,
  symbol?: string
): string {
  // If custom symbol provided, use it
  const currencySymbol = symbol || CURRENCY_SYMBOLS[currency as Currency] || currency;
  
  // Format with commas and handle decimals intelligently
  const formatted = amount.toLocaleString("en-US", { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2,
    useGrouping: true
  });
  return `${currencySymbol}${formatted}`;
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(currency: Currency | string = DEFAULT_CURRENCY): string {
  return CURRENCY_SYMBOLS[currency as Currency] || currency;
}

