/**
 * Utility functions for handling referral codes
 */

const REFERRAL_CODE_STORAGE_KEY = 'wagr_referral_code';
const REFERRAL_CODE_EXPIRY_DAYS = 30; // Referral code expires after 30 days

/**
 * Get referral code from URL query parameters
 */
export function getReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('ref') || urlParams.get('referral') || null;
}

/**
 * Store referral code in localStorage
 */
export function storeReferralCode(code: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + REFERRAL_CODE_EXPIRY_DAYS);
    
    const data = {
      code: code.toUpperCase().trim(),
      storedAt: new Date().toISOString(),
      expiresAt: expiryDate.toISOString(),
    };
    
    localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to store referral code:', error);
  }
}

/**
 * Get stored referral code from localStorage
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(REFERRAL_CODE_STORAGE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    const expiresAt = new Date(data.expiresAt);
    
    // Check if expired
    if (new Date() > expiresAt) {
      localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
      return null;
    }
    
    return data.code;
  } catch (error) {
    console.error('Failed to get stored referral code:', error);
    return null;
  }
}

/**
 * Clear stored referral code
 */
export function clearStoredReferralCode(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear referral code:', error);
  }
}

/**
 * Initialize referral code detection from URL
 * Call this on page load to detect and store referral codes
 */
export function initReferralCode(): string | null {
  const urlCode = getReferralCodeFromUrl();
  
  if (urlCode) {
    storeReferralCode(urlCode);
    return urlCode;
  }
  
  return null;
}

/**
 * Get referral code (from URL or storage)
 * Priority: URL > Storage
 */
export function getReferralCode(): string | null {
  const urlCode = getReferralCodeFromUrl();
  if (urlCode) {
    storeReferralCode(urlCode);
    return urlCode;
  }
  
  return getStoredReferralCode();
}

