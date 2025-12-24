import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Masks a username to protect user privacy
 * Shows first 2 characters (or 1 if username is 3 or less) and masks the rest
 * 
 * @param username - The username to mask, can be null or undefined
 * @returns Masked username string, or "Anonymous" if username is null/undefined
 * 
 * @example
 * maskUsername("john_doe") // "jo******"
 * maskUsername("alice") // "al***"
 * maskUsername("ab") // "a**"
 * maskUsername(null) // "Anonymous"
 */
export function maskUsername(username: string | null | undefined): string {
  if (!username) return "Anonymous";
  
  // If username is 3 characters or less, show first character only
  if (username.length <= 3) {
    return username[0] + "**";
  }
  
  // Show first 2 characters and mask the rest
  const visibleChars = Math.min(2, Math.floor(username.length / 3));
  const maskedChars = "*".repeat(Math.max(3, username.length - visibleChars));
  return username.substring(0, visibleChars) + maskedChars;
}
