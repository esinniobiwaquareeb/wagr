/**
 * Reusable Email Templates
 * Centralized email template system for all email types
 */

export type EmailType = 
  | 'verification' 
  | 'welcome' 
  | 'password-reset' 
  | 'password-changed' 
  | '2fa-enabled'
  | '2fa-disabled';

export interface EmailTemplateData {
  type: EmailType;
  recipientName?: string;
  recipientEmail: string;
  subject?: string;
  // Verification email
  verificationUrl?: string;
  // Password reset
  resetUrl?: string;
  resetCode?: string;
  // Welcome
  loginUrl?: string;
  // Password changed
  changeDate?: string;
  // 2FA
  action?: string;
}

/**
 * Generate email subject based on type
 */
export function getEmailSubject(type: EmailType, customSubject?: string): string {
  if (customSubject) return customSubject;

  const subjects: Record<EmailType, string> = {
    verification: 'Verify your wagr account',
    welcome: 'Welcome to wagr!',
    'password-reset': 'Reset your wagr password',
    'password-changed': 'Your wagr password was changed',
    '2fa-enabled': 'Two-factor authentication enabled',
    '2fa-disabled': 'Two-factor authentication disabled',
  };

  return subjects[type] || 'wagr notification';
}

/**
 * Generate HTML email content
 */
export function generateEmailHTML(data: EmailTemplateData): string {
  const { type, recipientName, recipientEmail } = data;
  const name = recipientName || recipientEmail.split('@')[0];
  const appName = 'wagr';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@wagr.app';

  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333333;
  `;

  const buttonStyles = `
    display: inline-block;
    padding: 12px 24px;
    background-color: #0070f3;
    color: #ffffff;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    margin: 16px 0;
  `;

  let content = '';
  let buttonText = '';
  let buttonUrl = '';
  let additionalInfo = '';

  switch (type) {
    case 'verification':
      content = `
        <p>Thanks for signing up for ${appName}! To get started, please verify your email address by clicking the button below.</p>
        <p>This link will expire in 24 hours for security reasons.</p>
      `;
      buttonText = 'Verify Email Address';
      buttonUrl = data.verificationUrl || `${appUrl}/verify-email`;
      additionalInfo = `
        <p style="font-size: 14px; color: #666666; margin-top: 24px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${buttonUrl}" style="color: #0070f3; word-break: break-all;">${buttonUrl}</a>
        </p>
      `;
      break;

    case 'welcome':
      content = `
        <p>Welcome to ${appName}! We're excited to have you join our community.</p>
        <p>You can now create wagers, join exciting challenges, and compete with others. Get started by exploring available wagers or creating your own!</p>
      `;
      buttonText = 'Get Started';
      buttonUrl = data.loginUrl || `${appUrl}/wagers`;
      additionalInfo = `
        <p style="font-size: 14px; color: #666666; margin-top: 24px;">
          If you have any questions, feel free to reach out to us at <a href="mailto:${supportEmail}" style="color: #0070f3;">${supportEmail}</a>
        </p>
      `;
      break;

    case 'password-reset':
      content = `
        <p>We received a request to reset your password for your ${appName} account.</p>
        <p>Click the button below to reset your password. This link will expire in 1 hour for security reasons.</p>
        ${data.resetCode ? `<p style="background-color: #f5f5f5; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0;">
          <strong>Reset Code:</strong> ${data.resetCode}
        </p>` : ''}
        <p style="color: #d32f2f; font-size: 14px;"><strong>If you didn't request this, please ignore this email and your password will remain unchanged.</strong></p>
      `;
      buttonText = 'Reset Password';
      buttonUrl = data.resetUrl || `${appUrl}/reset-password`;
      additionalInfo = `
        <p style="font-size: 14px; color: #666666; margin-top: 24px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${buttonUrl}" style="color: #0070f3; word-break: break-all;">${buttonUrl}</a>
        </p>
      `;
      break;

    case 'password-changed':
      content = `
        <p>Your ${appName} account password was successfully changed.</p>
        <p><strong>Date:</strong> ${data.changeDate || new Date().toLocaleString()}</p>
        <p style="color: #d32f2f; font-size: 14px;"><strong>If you didn't make this change, please contact us immediately at <a href="mailto:${supportEmail}" style="color: #0070f3;">${supportEmail}</a></strong></p>
      `;
      buttonText = 'Go to Account';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = '';
      break;

    case '2fa-enabled':
      content = `
        <p>Two-factor authentication has been enabled for your ${appName} account.</p>
        <p>Your account is now more secure. You'll be asked for a verification code each time you sign in.</p>
      `;
      buttonText = 'Manage Security';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = `
        <p style="color: #d32f2f; font-size: 14px; margin-top: 24px;">
          <strong>If you didn't enable this, please contact us immediately at <a href="mailto:${supportEmail}" style="color: #0070f3;">${supportEmail}</a></strong>
        </p>
      `;
      break;

    case '2fa-disabled':
      content = `
        <p>Two-factor authentication has been disabled for your ${appName} account.</p>
        <p>Your account security has been reduced. You can re-enable 2FA anytime from your profile settings.</p>
      `;
      buttonText = 'Manage Security';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = `
        <p style="color: #d32f2f; font-size: 14px; margin-top: 24px;">
          <strong>If you didn't disable this, please contact us immediately at <a href="mailto:${supportEmail}" style="color: #0070f3;">${supportEmail}</a></strong>
        </p>
      `;
      break;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailSubject(type)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #0070f3 0%, #0051cc 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${appName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; ${baseStyles} font-size: 24px; color: #1a1a1a;">
                ${getEmailSubject(type)}
              </h2>
              
              <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">
                Hi ${name},
              </p>
              
              <div style="${baseStyles} font-size: 16px;">
                ${content}
              </div>
              
              ${buttonUrl ? `
              <div style="text-align: center; margin: 32px 0;">
                <a href="${buttonUrl}" style="${buttonStyles}">${buttonText}</a>
              </div>
              ` : ''}
              
              ${additionalInfo}
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">
              
              <p style="margin: 0; ${baseStyles} font-size: 14px; color: #666666;">
                Best regards,<br>
                The ${appName} Team
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; text-align: center; background-color: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; ${baseStyles} font-size: 12px; color: #999999;">
                This email was sent to ${recipientEmail}
              </p>
              <p style="margin: 0; ${baseStyles} font-size: 12px; color: #999999;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email content (fallback)
 */
export function generateEmailText(data: EmailTemplateData): string {
  const { type, recipientName, recipientEmail } = data;
  const name = recipientName || recipientEmail.split('@')[0];
  const appName = 'wagr';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app';

  let content = '';

  switch (type) {
    case 'verification':
      content = `Hi ${name},\n\nThanks for signing up for ${appName}! To get started, please verify your email address by visiting:\n\n${data.verificationUrl || `${appUrl}/verify-email`}\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe ${appName} Team`;
      break;
    case 'welcome':
      content = `Hi ${name},\n\nWelcome to ${appName}! We're excited to have you join our community.\n\nGet started: ${data.loginUrl || `${appUrl}/wagers`}\n\nBest regards,\nThe ${appName} Team`;
      break;
    case 'password-reset':
      content = `Hi ${name},\n\nWe received a request to reset your password. Visit:\n\n${data.resetUrl || `${appUrl}/reset-password`}\n\n${data.resetCode ? `Reset Code: ${data.resetCode}\n\n` : ''}This link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe ${appName} Team`;
      break;
    case 'password-changed':
      content = `Hi ${name},\n\nYour ${appName} password was successfully changed on ${data.changeDate || new Date().toLocaleString()}.\n\nIf you didn't make this change, please contact us immediately.\n\nBest regards,\nThe ${appName} Team`;
      break;
    case '2fa-enabled':
      content = `Hi ${name},\n\nTwo-factor authentication has been enabled for your ${appName} account.\n\nIf you didn't enable this, please contact us immediately.\n\nBest regards,\nThe ${appName} Team`;
      break;
    case '2fa-disabled':
      content = `Hi ${name},\n\nTwo-factor authentication has been disabled for your ${appName} account.\n\nIf you didn't disable this, please contact us immediately.\n\nBest regards,\nThe ${appName} Team`;
      break;
  }

  return content;
}

