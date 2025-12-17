// Helper functions for calculating wager returns and potential winnings

export interface WagerCalculationParams {
  entryAmount: number; // The amount the user is wagering
  sideATotal: number; // Total amount bet on side A (sum of all entries)
  sideBTotal: number; // Total amount bet on side B (sum of all entries)
  feePercentage: number;
}

export interface PotentialReturn {
  totalPool: number;
  platformFee: number;
  winningsPool: number;
  sideAPotential: number;
  sideBPotential: number;
  sideAReturnMultiplier: number;
  sideBReturnMultiplier: number;
  sideAReturnPercentage: number;
  sideBReturnPercentage: number;
}

/**
 * Calculate potential returns for a wager
 * Uses actual wager amounts, not just counts, so multiple people wagering different amounts are handled correctly
 */
export function calculatePotentialReturns(params: WagerCalculationParams): PotentialReturn {
  const { entryAmount, sideATotal, sideBTotal, feePercentage } = params;

  const safeEntryAmount = Number(entryAmount);

  // Guard against invalid or zero entry amounts to avoid NaN/Infinity
  if (!Number.isFinite(safeEntryAmount) || safeEntryAmount <= 0) {
    const basePool = sideATotal + sideBTotal;
    const basePlatformFee = basePool * feePercentage;
    const baseWinningsPool = basePool - basePlatformFee;

    return {
      totalPool: basePool,
      platformFee: basePlatformFee,
      winningsPool: baseWinningsPool,
      sideAPotential: 0,
      sideBPotential: 0,
      sideAReturnMultiplier: 1,
      sideBReturnMultiplier: 1,
      sideAReturnPercentage: 0,
      sideBReturnPercentage: 0,
    };
  }

  // Calculate total pool (sum of all bets on both sides)
  const totalPool = sideATotal + sideBTotal;

  // Calculate platform fee
  const platformFee = totalPool * feePercentage;

  // Calculate winnings pool (after fee)
  const winningsPool = totalPool - platformFee;

  // Calculate potential winnings for each side
  // If user joins side A and wins: (entryAmount / (sideATotal + entryAmount)) * winningsPool
  // If user joins side B and wins: (entryAmount / (sideBTotal + entryAmount)) * winningsPool
  // Note: We add entryAmount to the side total because the user's bet will be included
  const sideAPotential = sideATotal + safeEntryAmount > 0
    ? (safeEntryAmount / (sideATotal + safeEntryAmount)) * (winningsPool + safeEntryAmount)
    : safeEntryAmount; // If no one on side A yet, user gets their bet back

  const sideBPotential = sideBTotal + safeEntryAmount > 0
    ? (safeEntryAmount / (sideBTotal + safeEntryAmount)) * (winningsPool + safeEntryAmount)
    : safeEntryAmount; // If no one on side B yet, user gets their bet back

  // Calculate return multipliers (how much you get back per unit invested)
  const sideAReturnMultiplier = sideAPotential / safeEntryAmount;
  const sideBReturnMultiplier = sideBPotential / safeEntryAmount;

  // Calculate return percentage (profit percentage)
  const sideAReturnPercentage = ((sideAPotential - safeEntryAmount) / safeEntryAmount) * 100;
  const sideBReturnPercentage = ((sideBPotential - safeEntryAmount) / safeEntryAmount) * 100;

  return {
    totalPool: totalPool + safeEntryAmount, // Include user's bet in total
    platformFee: (totalPool + safeEntryAmount) * feePercentage, // Recalculate with user's bet
    winningsPool: (totalPool + safeEntryAmount) * (1 - feePercentage), // Recalculate with user's bet
    sideAPotential,
    sideBPotential,
    sideAReturnMultiplier,
    sideBReturnMultiplier,
    sideAReturnPercentage,
    sideBReturnPercentage,
  };
}

/**
 * Format return multiplier for display (e.g., "2.5x" or "1.2x")
 */
export function formatReturnMultiplier(multiplier: number): string {
  if (multiplier < 1) return "1.0x";
  return `${multiplier.toFixed(2)}x`;
}

/**
 * Format return percentage for display (e.g., "+150%" or "-20%")
 */
export function formatReturnPercentage(percentage: number): string {
  const sign = percentage >= 0 ? "+" : "";
  return `${sign}${percentage.toFixed(1)}%`;
}

