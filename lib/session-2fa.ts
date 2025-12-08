/**
 * Session-based 2FA verification tracking
 * This ensures that 2FA is required on every new login session
 */

const SESSION_2FA_KEY = '2fa_verified_session';

/**
 * Mark a session as 2FA verified
 * This should be called after successful 2FA verification
 */
export function markSessionAs2FAVerified(userId: string): void {
  if (typeof window === 'undefined') return;
  
  // Store in sessionStorage (cleared when browser tab closes)
  const sessionData = {
    userId,
    timestamp: Date.now(),
    verified: true,
  };
  
  sessionStorage.setItem(SESSION_2FA_KEY, JSON.stringify(sessionData));
}

/**
 * Check if current session is 2FA verified
 * Returns true if verified, false if not verified or session expired
 */
export function isSession2FAVerified(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const stored = sessionStorage.getItem(SESSION_2FA_KEY);
    if (!stored) return false;
    
    const sessionData = JSON.parse(stored);
    
    // Verify it's for the same user
    if (sessionData.userId !== userId) {
      sessionStorage.removeItem(SESSION_2FA_KEY);
      return false;
    }
    
    // Check if session is still valid (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - sessionData.timestamp > maxAge) {
      sessionStorage.removeItem(SESSION_2FA_KEY);
      return false;
    }
    
    return sessionData.verified === true;
  } catch {
    return false;
  }
}

/**
 * Clear 2FA verification (on logout)
 */
export function clear2FAVerification(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_2FA_KEY);
}

/**
 * Check if user needs 2FA verification for this login attempt
 * This should be called before allowing login to proceed
 * 
 * @deprecated This function is no longer used - 2FA check is handled by NestJS backend
 */
export async function requires2FAForLogin(
  userId: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<boolean> {
  // If session is already verified, no need for 2FA again
  if (isSession2FAVerified(userId)) {
    return false;
  }
  
  // 2FA check is now handled by the NestJS backend during login
  // This function is kept for backward compatibility but always returns false
  return false;
}

