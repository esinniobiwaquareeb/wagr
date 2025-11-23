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
  | '2fa-disabled'
  | 'wager-invitation';

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
  // Wager invitation
  inviterName?: string;
  wagerTitle?: string;
  wagerDescription?: string;
  wagerUrl?: string;
  sideA?: string;
  sideB?: string;
  amount?: number;
  deadline?: string;
}

/**
 * Generate email subject based on type
 */
export function getEmailSubject(type: EmailType, customSubject?: string): string {
  if (customSubject) return customSubject;

  const subjects: Record<EmailType, string> = {
    verification: 'Verify your iwagr account',
    welcome: 'Welcome to iwagr!',
    'password-reset': 'Reset your iwagr password',
    'password-changed': 'Your iwagr password was changed',
    '2fa-enabled': 'Two-factor authentication enabled',
    '2fa-disabled': 'Two-factor authentication disabled',
    'wager-invitation': 'You\'ve been invited to a wager!',
  };

  return subjects[type] || 'wagr notification';
}

/**
 * Generate HTML email content
 */
export function generateEmailHTML(data: EmailTemplateData): string {
  const { type, recipientName, recipientEmail } = data;
  const name = recipientName || recipientEmail.split('@')[0];
  const appName = 'iwagr';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://iwagr.app';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@iwagr.app';
  const currency = (process.env.DEFAULT_CURRENCY || 'NGN') as 'NGN' | 'USD' | 'GBP' | 'EUR';
  
  // Helper function for currency formatting
  const formatCurrency = (amount: number, curr: string = currency) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.7;
    color: #1a1a1a;
  `;

  const buttonStyles = `
    display: inline-block;
    padding: 14px 32px;
    background: linear-gradient(135deg, #0070f3 0%, #0051cc 100%);
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    margin: 24px 0;
    box-shadow: 0 4px 12px rgba(0, 112, 243, 0.3);
    transition: all 0.2s ease;
  `;

  let content = '';
  let buttonText = '';
  let buttonUrl = '';
  let additionalInfo = '';

  switch (type) {
    case 'verification':
      content = `
        <p style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">Welcome to ${appName}! 🎉</p>
        <p>We're thrilled to have you join our community of wager enthusiasts. To get started and ensure the security of your account, please verify your email address by clicking the button below.</p>
        <p style="background-color: #f8f9fa; padding: 16px; border-left: 4px solid #0070f3; border-radius: 4px; margin: 20px 0;">
          <strong>⏰ Security Note:</strong> This verification link will expire in 24 hours for your protection.
        </p>
      `;
      buttonText = '✓ Verify Email Address';
      buttonUrl = data.verificationUrl || `${appUrl}/verify-email`;
      additionalInfo = `
        <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin-top: 24px;">
          <p style="font-size: 13px; color: #666666; margin: 0 0 8px 0;">
            <strong>Having trouble clicking the button?</strong>
          </p>
          <p style="font-size: 13px; color: #666666; margin: 0; word-break: break-all;">
            Copy and paste this link into your browser:<br>
            <a href="${buttonUrl}" style="color: #0070f3; text-decoration: underline;">${buttonUrl}</a>
          </p>
        </div>
      `;
      break;

    case 'welcome':
      content = `
        <p style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">Welcome to ${appName}! 🚀</p>
        <p>You're all set! Your account is verified and ready to go. Join thousands of users who are already creating exciting wagers and competing for wins.</p>
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 12px 0; font-weight: 600; color: #1a1a1a;">What you can do:</p>
          <ul style="margin: 0; padding-left: 20px; color: #495057;">
            <li>Create custom wagers on topics you care about</li>
            <li>Join exciting challenges from other users</li>
            <li>Compete and win real rewards</li>
            <li>Track your wager history and performance</li>
          </ul>
        </div>
        <p style="margin-top: 20px;">Ready to make your first wager? Let's get started!</p>
      `;
      buttonText = '🎯 Explore Wagers';
      buttonUrl = data.loginUrl || `${appUrl}/wagers`;
      additionalInfo = `
        <p style="font-size: 14px; color: #666666; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e9ecef;">
          Need help? We're here for you! Reach out at <a href="mailto:${supportEmail}" style="color: #0070f3; font-weight: 500;">${supportEmail}</a> and we'll get back to you within 24 hours.
        </p>
      `;
      break;

    case 'password-reset':
      content = `
        <p style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">Password Reset Request 🔐</p>
        <p>We received a request to reset the password for your ${appName} account. No worries—these things happen!</p>
        <p>Click the button below to create a new secure password. This link will expire in <strong>1 hour</strong> for your security.</p>
        ${data.resetCode ? `
        <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); padding: 20px; border-radius: 8px; border: 2px solid #ffc107; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #856404; font-weight: 600;">Your Reset Code:</p>
          <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; color: #856404; letter-spacing: 4px;">${data.resetCode}</p>
        </div>
        ` : ''}
        <div style="background-color: #fff3cd; padding: 16px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>⚠️ Didn't request this?</strong> If you didn't request a password reset, please ignore this email and your password will remain unchanged. If you're concerned about your account security, contact us immediately.
          </p>
        </div>
      `;
      buttonText = '🔑 Reset My Password';
      buttonUrl = data.resetUrl || `${appUrl}/reset-password`;
      additionalInfo = `
        <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin-top: 24px;">
          <p style="font-size: 13px; color: #666666; margin: 0 0 8px 0;">
            <strong>Button not working?</strong>
          </p>
          <p style="font-size: 13px; color: #666666; margin: 0; word-break: break-all;">
            Copy and paste this link into your browser:<br>
            <a href="${buttonUrl}" style="color: #0070f3; text-decoration: underline;">${buttonUrl}</a>
          </p>
        </div>
      `;
      break;

    case 'password-changed':
      content = `
        <p style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">Password Successfully Changed ✅</p>
        <p>Your ${appName} account password has been successfully updated.</p>
        <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #495057;">
            <strong>Change Date:</strong> ${data.changeDate || new Date().toLocaleString()}
          </p>
        </div>
        <div style="background-color: #fff3cd; padding: 16px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>🔒 Security Alert:</strong> If you didn't make this change, your account may be compromised. Please contact us immediately at <a href="mailto:${supportEmail}" style="color: #0070f3; font-weight: 600;">${supportEmail}</a> so we can secure your account right away.
          </p>
        </div>
      `;
      buttonText = '👤 View My Account';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = '';
      break;

    case '2fa-enabled':
      content = `
        <p style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">Two-Factor Authentication Enabled 🛡️</p>
        <p>Great news! Two-factor authentication (2FA) has been successfully enabled for your ${appName} account.</p>
        <div style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); padding: 20px; border-radius: 8px; border: 2px solid #28a745; margin: 20px 0;">
          <p style="margin: 0 0 12px 0; font-weight: 600; color: #155724;">What this means:</p>
          <ul style="margin: 0; padding-left: 20px; color: #155724;">
            <li>Your account is now significantly more secure</li>
            <li>You'll need a verification code from your authenticator app when signing in</li>
            <li>This helps protect your account from unauthorized access</li>
          </ul>
        </div>
        <p style="margin-top: 20px;">You can manage your security settings anytime from your profile.</p>
      `;
      buttonText = '⚙️ Manage Security';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = `
        <div style="background-color: #fff3cd; padding: 16px; border-left: 4px solid #ffc107; border-radius: 4px; margin-top: 24px;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>⚠️ Didn't enable this?</strong> If you didn't enable 2FA, please contact us immediately at <a href="mailto:${supportEmail}" style="color: #0070f3; font-weight: 600;">${supportEmail}</a> so we can secure your account.
          </p>
        </div>
      `;
      break;

    case '2fa-disabled':
      content = `
        <p style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">Two-Factor Authentication Disabled ⚠️</p>
        <p>Two-factor authentication (2FA) has been disabled for your ${appName} account.</p>
        <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); padding: 20px; border-radius: 8px; border: 2px solid #ffc107; margin: 20px 0;">
          <p style="margin: 0 0 12px 0; font-weight: 600; color: #856404;">Important Security Note:</p>
          <p style="margin: 0; color: #856404;">
            Your account security level has been reduced. We strongly recommend re-enabling 2FA to protect your account and funds.
          </p>
        </div>
        <p style="margin-top: 20px;">You can re-enable 2FA anytime from your profile security settings.</p>
      `;
      buttonText = '🔒 Re-enable 2FA';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = `
        <div style="background-color: #fff3cd; padding: 16px; border-left: 4px solid #ffc107; border-radius: 4px; margin-top: 24px;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>🔒 Security Alert:</strong> If you didn't disable 2FA, please contact us immediately at <a href="mailto:${supportEmail}" style="color: #0070f3; font-weight: 600;">${supportEmail}</a> so we can secure your account right away.
          </p>
        </div>
      `;
      break;

    case 'wager-invitation':
      const inviterName = data.inviterName || 'Someone';
      const wagerTitle = data.wagerTitle || 'a wager';
      const wagerDescription = data.wagerDescription || '';
      const sideA = data.sideA || 'Side A';
      const sideB = data.sideB || 'Side B';
      const amount = data.amount || 0;
      const deadline = data.deadline ? new Date(data.deadline).toLocaleDateString() : '';
      const wagerInviteUrl = data.wagerUrl || `${appUrl}/wagers`;
      
      content = `
        <p style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">You've been invited to a wager! 🎯</p>
        <p><strong>${inviterName}</strong> has invited you to join an exciting wager on ${appName}.</p>
        
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 24px; border-radius: 12px; border: 2px solid #0070f3; margin: 24px 0;">
          <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">${wagerTitle}</h3>
          ${wagerDescription ? `<p style="margin: 0 0 16px 0; color: #495057; line-height: 1.6;">${wagerDescription}</p>` : ''}
          
          <div style="display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 120px; background: white; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6c757d; font-weight: 600;">SIDE A</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${sideA}</p>
            </div>
            <div style="flex: 1; min-width: 120px; background: white; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6c757d; font-weight: 600;">SIDE B</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${sideB}</p>
            </div>
          </div>
          
          <div style="display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 100px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6c757d; font-weight: 600;">WAGER AMOUNT</p>
              <p style="margin: 0; font-size: 18px; font-weight: 700; color: #0070f3;">${formatCurrency(amount)}</p>
            </div>
            ${deadline ? `
            <div style="flex: 1; min-width: 100px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6c757d; font-weight: 600;">DEADLINE</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${deadline}</p>
            </div>
            ` : ''}
          </div>
        </div>
        
        <p style="margin-top: 20px;">Join ${appName} to participate in this wager and compete for exciting rewards!</p>
      `;
      buttonText = '🎯 Join Wager';
      buttonUrl = wagerInviteUrl;
      additionalInfo = `
        <p style="font-size: 14px; color: #666666; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e9ecef;">
          Don't have an account? <a href="${appUrl}/wagers?signup=true" style="color: #0070f3; font-weight: 500;">Sign up for free</a> to join this wager and start competing!
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
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${getEmailSubject(type)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f7fa;">
    <tr>
      <td style="padding: 40px 20px; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.06); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 0;">
              <div style="background: linear-gradient(135deg, #0070f3 0%, #0051cc 100%); padding: 48px 40px 32px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${appName.toUpperCase()}</h1>
                <div style="width: 60px; height: 4px; background-color: rgba(255, 255, 255, 0.3); border-radius: 2px; margin: 16px auto 0;"></div>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px;">
              <h2 style="margin: 0 0 24px; ${baseStyles} font-size: 26px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px;">
                ${getEmailSubject(type)}
              </h2>
              
              <p style="margin: 0 0 20px; ${baseStyles} font-size: 16px; color: #495057;">
                Hi ${name},
              </p>
              
              <div style="${baseStyles} font-size: 16px; color: #495057;">
                ${content}
              </div>
              
              ${buttonUrl ? `
              <div style="text-align: center; margin: 36px 0;">
                <a href="${buttonUrl}" style="${buttonStyles}">${buttonText}</a>
              </div>
              ` : ''}
              
              ${additionalInfo}
              
              <div style="border-top: 2px solid #e9ecef; margin: 40px 0 24px; padding-top: 24px;">
                <p style="margin: 0 0 8px; ${baseStyles} font-size: 15px; color: #495057; font-weight: 500;">
                  Best regards,
                </p>
                <p style="margin: 0; ${baseStyles} font-size: 15px; color: #0070f3; font-weight: 600;">
                  The ${appName} Team
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%); border-top: 1px solid #dee2e6;">
              <p style="margin: 0 0 12px; ${baseStyles} font-size: 13px; color: #6c757d;">
                This email was sent to <a href="mailto:${recipientEmail}" style="color: #0070f3; text-decoration: none;">${recipientEmail}</a>
              </p>
              <p style="margin: 0 0 16px; ${baseStyles} font-size: 12px; color: #868e96;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #dee2e6;">
                <p style="margin: 0; ${baseStyles} font-size: 12px; color: #868e96;">
                  <a href="${appUrl}" style="color: #0070f3; text-decoration: none; margin: 0 12px;">Visit Website</a>
                  <span style="color: #dee2e6;">|</span>
                  <a href="mailto:${supportEmail}" style="color: #0070f3; text-decoration: none; margin: 0 12px;">Contact Support</a>
                </p>
              </div>
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
    case 'wager-invitation':
      const inviterNameText = data.inviterName || 'Someone';
      const wagerTitleText = data.wagerTitle || 'a wager';
      const wagerDescriptionText = data.wagerDescription || '';
      const sideAText = data.sideA || 'Side A';
      const sideBText = data.sideB || 'Side B';
      const amountText = data.amount || 0;
      const deadlineText = data.deadline ? new Date(data.deadline).toLocaleDateString() : '';
      const wagerUrlText = data.wagerUrl || `${appUrl}/wagers`;
      content = `Hi ${name},\n\n${inviterNameText} has invited you to join a wager on ${appName}!\n\nWager: ${wagerTitleText}\n${wagerDescriptionText ? `Description: ${wagerDescriptionText}\n` : ''}\nSide A: ${sideAText}\nSide B: ${sideBText}\nAmount: ${amountText}\n${deadlineText ? `Deadline: ${deadlineText}\n` : ''}\nJoin now: ${wagerUrlText}\n\nDon't have an account? Sign up for free at ${appUrl}/wagers?signup=true\n\nBest regards,\nThe ${appName} Team`;
      break;
  }

  return content;
}

