export type Currency = "NGN" | "USD" | "EUR" | "GBP";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  NGN: "₦",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const DEFAULT_CURRENCY: Currency = "NGN";

export function formatCurrency(amount: number, currency: Currency = DEFAULT_CURRENCY): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function getCurrencySymbol(currency: Currency = DEFAULT_CURRENCY): string {
  return CURRENCY_SYMBOLS[currency];
}

