// Helper functions for calculating wager returns and potential winnings

export interface WagerCalculationParams {
  entryAmount: number; // The amount the user is wagering
  sideATotal: number; // Total amount wagered on side A (sum of all entries)
  sideBTotal: number; // Total amount wagered on side B (sum of all entries)
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

  // Calculate total pool (sum of all wagers on both sides)
  const totalPool = sideATotal + sideBTotal;

  // Calculate platform fee
  const platformFee = totalPool * feePercentage;

  // Calculate winnings pool (after fee)
  const winningsPool = totalPool - platformFee;

  // Calculate NEW totals after user joins (for accurate potential returns)
  const newTotalPool = totalPool + safeEntryAmount;
  const newPlatformFee = newTotalPool * feePercentage;
  const newWinningsPool = newTotalPool - newPlatformFee;

  // Calculate potential winnings for each side
  // Formula matches actual settlement: (entryAmount / newSideTotal) * newWinningsPool
  // This ensures the calculation matches what users will actually receive
  
  const newSideATotal = sideATotal + safeEntryAmount; // If joining side A
  const newSideBTotal = sideBTotal + safeEntryAmount; // If joining side B

  // Calculate potential if user joins side A
  const sideAPotential = newSideATotal > 0
    ? (safeEntryAmount / newSideATotal) * newWinningsPool
    : safeEntryAmount; // If no one on side A yet, user gets their wager back

  // Calculate potential if user joins side B
  const sideBPotential = newSideBTotal > 0
    ? (safeEntryAmount / newSideBTotal) * newWinningsPool
    : safeEntryAmount; // If no one on side B yet, user gets their wager back

  // Calculate return multipliers (how much you get back per unit invested)
  const sideAReturnMultiplier = safeEntryAmount > 0 ? sideAPotential / safeEntryAmount : 1;
  const sideBReturnMultiplier = safeEntryAmount > 0 ? sideBPotential / safeEntryAmount : 1;

  // Calculate return percentage (profit percentage)
  const sideAReturnPercentage = safeEntryAmount > 0 
    ? ((sideAPotential - safeEntryAmount) / safeEntryAmount) * 100 
    : 0;
  const sideBReturnPercentage = safeEntryAmount > 0
    ? ((sideBPotential - safeEntryAmount) / safeEntryAmount) * 100
    : 0;

  return {
    totalPool: newTotalPool, // Total pool after user joins
    platformFee: newPlatformFee, // Platform fee on new total
    winningsPool: newWinningsPool, // Winnings pool after fee
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

