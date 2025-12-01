/**
 * Utility functions for detecting similar/duplicate wager titles
 */

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const maxLength = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Check if two titles are similar enough to be considered duplicates
 * Uses multiple heuristics:
 * 1. Exact match (case-insensitive)
 * 2. High similarity score (>0.85)
 * 3. Contains check (one title contains the other)
 */
export function areTitlesSimilar(title1: string, title2: string, threshold: number = 0.85): boolean {
  const t1 = title1.toLowerCase().trim();
  const t2 = title2.toLowerCase().trim();
  
  // Exact match
  if (t1 === t2) return true;
  
  // High similarity
  if (calculateSimilarity(t1, t2) >= threshold) return true;
  
  // One contains the other (for titles like "Will Bitcoin reach $100k?" vs "Will Bitcoin reach $100k by 2025?")
  const words1 = t1.split(/\s+/).filter(w => w.length > 3); // Filter out short words
  const words2 = t2.split(/\s+/).filter(w => w.length > 3);
  
  if (words1.length > 0 && words2.length > 0) {
    const commonWords = words1.filter(w => words2.includes(w));
    const minWords = Math.min(words1.length, words2.length);
    
    // If 80% of words match, consider similar
    if (minWords > 0 && commonWords.length / minWords >= 0.8) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate title suggestions based on existing similar titles
 */
export function generateTitleSuggestions(userTitle: string, existingTitles: string[]): string[] {
  const suggestions: string[] = [];
  const baseTitle = userTitle.trim();
  
  // Add date/time variations
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  suggestions.push(`${baseTitle} (${dateStr})`);
  
  // Add "v2" or "2025" suffix
  suggestions.push(`${baseTitle} v2`);
  suggestions.push(`${baseTitle} 2025`);
  
  // Add "Part 2" suffix
  suggestions.push(`${baseTitle} - Part 2`);
  
  // Add question mark if not present
  if (!baseTitle.endsWith('?')) {
    suggestions.push(`${baseTitle}?`);
  }
  
  return suggestions.slice(0, 3); // Return top 3 suggestions
}

