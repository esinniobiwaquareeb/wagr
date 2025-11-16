import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Generate a new 2FA secret and QR code
 */
export async function generate2FASecret(email: string, issuer: string = 'wagr'): Promise<TwoFactorSetup> {
  // Generate secret
  const secret = authenticator.generateSecret();
  
  // Create service name for QR code
  const serviceName = `${issuer}:${email}`;
  
  // Generate otpauth URL
  const otpauthUrl = authenticator.keyuri(email, issuer, secret);

  // Generate QR code
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  // Generate backup codes (8 codes, 8 characters each)
  const backupCodes = Array.from({ length: 8 }, () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  });

  return {
    secret,
    qrCode,
    backupCodes,
  };
}

/**
 * Verify a TOTP code
 */
export function verify2FACode(secret: string, code: string): boolean {
  try {
    // Verify with window of ±1 period (30 seconds) for clock skew
    return authenticator.check(code, secret);
  } catch (error) {
    console.error('2FA verification error:', error);
    return false;
  }
}

/**
 * Verify a backup code
 */
export function verifyBackupCode(backupCodes: string[], code: string): boolean {
  const normalizedCode = code.toUpperCase().trim();
  return backupCodes.includes(normalizedCode);
}

