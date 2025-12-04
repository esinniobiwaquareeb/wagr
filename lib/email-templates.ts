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
  | 'wager-invitation'
  | 'quiz-invitation'
  | 'quiz-settlement'
  | 'kyc-approved'
  | 'kyc-rejected';

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
  // Quiz invitation
  quizTitle?: string;
  quizDescription?: string;
  quizUrl?: string;
  entryFeePerQuestion?: number;
  totalQuestions?: number;
  maxParticipants?: number;
  endDate?: string;
  // Quiz settlement (reuses amount from wager invitation)
  won?: boolean;
  rank?: number | null;
  // KYC
  kycLevel?: number;
  kycLevelLabel?: string;
  rejectionReason?: string;
}

/**
 * Generate email subject based on type
 */
export function getEmailSubject(type: EmailType, customSubject?: string): string {
  if (customSubject) return customSubject;

  const subjects: Record<EmailType, string> = {
    verification: 'Verify your wagered.app account',
    welcome: 'Welcome to wagered.app!',
    'password-reset': 'Reset your wagered.app password',
    'password-changed': 'Your wagered.app password was changed',
    '2fa-enabled': 'Two-factor authentication enabled',
    '2fa-disabled': 'Two-factor authentication disabled',
    'wager-invitation': 'You\'ve been invited to a wager!',
    'quiz-invitation': 'You\'ve been invited to a quiz!',
    'quiz-settlement': 'Quiz Results Available',
    'kyc-approved': 'KYC Verification Approved',
    'kyc-rejected': 'KYC Verification Rejected',
  };

  return subjects[type] || 'wagered.app notification';
}

/**
 * Generate HTML email content
 */
export function generateEmailHTML(data: EmailTemplateData): string {
  const { type, recipientName, recipientEmail } = data;
  const name = recipientName || recipientEmail.split('@')[0];
  const appName = 'wagered.app';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@wagered.app';
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
    line-height: 1.6;
    color: #1f2937;
  `;

  const buttonStyles = `
    display: inline-block;
    padding: 12px 28px;
    background-color: #107DFF;
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 15px;
    margin: 24px 0;
  `;

  let content = '';
  let buttonText = '';
  let buttonUrl = '';
  let additionalInfo = '';

  switch (type) {
    case 'verification':
      content = `
        <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">Welcome to ${appName}! We're excited to have you join our community.</p>
        <p style="margin: 0 0 24px; ${baseStyles} font-size: 16px;">To get started and ensure the security of your account, please verify your email address by clicking the button below.</p>
        <div style="background-color: #eff6ff; padding: 16px; border-left: 3px solid #107DFF; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0; ${baseStyles} font-size: 14px; color: #1e40af;">
            <strong>Security Note:</strong> This verification link will expire in 24 hours.
          </p>
        </div>
      `;
      buttonText = 'Verify Email Address';
      buttonUrl = data.verificationUrl || `${appUrl}/verify-email`;
      additionalInfo = `
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 32px;">
          <p style="margin: 0 0 8px; ${baseStyles} font-size: 13px; color: #6b7280; font-weight: 600;">
            Having trouble clicking the button?
          </p>
          <p style="margin: 0; ${baseStyles} font-size: 13px; color: #6b7280; word-break: break-all;">
            Copy and paste this link into your browser:<br>
            <a href="${buttonUrl}" style="color: #107DFF; text-decoration: underline;">${buttonUrl}</a>
          </p>
        </div>
      `;
      break;

    case 'welcome':
      content = `
        <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">Your account is verified and ready to go. Join thousands of users who are already creating exciting wagers and competing for wins.</p>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 24px 0;">
          <p style="margin: 0 0 12px; ${baseStyles} font-size: 15px; font-weight: 600; color: #1f2937;">What you can do:</p>
          <ul style="margin: 0; padding-left: 20px; ${baseStyles} font-size: 15px; color: #4b5563;">
            <li style="margin-bottom: 8px;">Create custom wagers on topics you care about</li>
            <li style="margin-bottom: 8px;">Join exciting challenges from other users</li>
            <li style="margin-bottom: 8px;">Compete and win real rewards</li>
            <li>Track your wager history and performance</li>
          </ul>
        </div>
        <p style="margin: 24px 0 0; ${baseStyles} font-size: 16px;">Ready to make your first wager? Let's get started!</p>
      `;
      buttonText = 'Explore Wagers';
      buttonUrl = data.loginUrl || `${appUrl}/wagers`;
      additionalInfo = `
        <p style="margin: 32px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; ${baseStyles} font-size: 14px; color: #6b7280;">
          Need help? Contact us at <a href="mailto:${supportEmail}" style="color: #107DFF; text-decoration: none; font-weight: 500;">${supportEmail}</a> and we'll get back to you within 24 hours.
        </p>
      `;
      break;

    case 'password-reset':
      content = `
        <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">We received a request to reset the password for your ${appName} account.</p>
        <p style="margin: 0 0 24px; ${baseStyles} font-size: 16px;">Click the button below to create a new secure password. This link will expire in <strong>1 hour</strong> for your security.</p>
        ${data.resetCode ? `
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 6px; border: 1px solid #fbbf24; margin: 24px 0;">
          <p style="margin: 0 0 8px; ${baseStyles} font-size: 13px; color: #92400e; font-weight: 600;">Your Reset Code:</p>
          <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; color: #92400e; letter-spacing: 3px;">${data.resetCode}</p>
        </div>
        ` : ''}
        <div style="background-color: #fef3c7; padding: 16px; border-left: 3px solid #f59e0b; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0; ${baseStyles} font-size: 14px; color: #92400e;">
            <strong>Didn't request this?</strong> If you didn't request a password reset, please ignore this email and your password will remain unchanged. If you're concerned about your account security, contact us immediately.
          </p>
        </div>
      `;
      buttonText = 'Reset My Password';
      buttonUrl = data.resetUrl || `${appUrl}/reset-password`;
      additionalInfo = `
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 32px;">
          <p style="margin: 0 0 8px; ${baseStyles} font-size: 13px; color: #6b7280; font-weight: 600;">
            Button not working?
          </p>
          <p style="margin: 0; ${baseStyles} font-size: 13px; color: #6b7280; word-break: break-all;">
            Copy and paste this link into your browser:<br>
            <a href="${buttonUrl}" style="color: #107DFF; text-decoration: underline;">${buttonUrl}</a>
          </p>
        </div>
      `;
      break;

    case 'password-changed':
      content = `
        <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">Your ${appName} account password has been successfully updated.</p>
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin: 24px 0;">
          <p style="margin: 0; ${baseStyles} font-size: 14px; color: #4b5563;">
            <strong>Change Date:</strong> ${data.changeDate || new Date().toLocaleString()}
          </p>
        </div>
        <div style="background-color: #fef3c7; padding: 16px; border-left: 3px solid #f59e0b; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0; ${baseStyles} font-size: 14px; color: #92400e;">
            <strong>Security Alert:</strong> If you didn't make this change, your account may be compromised. Please contact us immediately at <a href="mailto:${supportEmail}" style="color: #107DFF; text-decoration: none; font-weight: 600;">${supportEmail}</a> so we can secure your account right away.
          </p>
        </div>
      `;
      buttonText = 'View My Account';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = '';
      break;

    case '2fa-enabled':
      content = `
        <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">Two-factor authentication (2FA) has been successfully enabled for your ${appName} account.</p>
        <div style="background-color: #d1fae5; padding: 20px; border-radius: 6px; border: 1px solid #10b981; margin: 24px 0;">
          <p style="margin: 0 0 12px; ${baseStyles} font-size: 15px; font-weight: 600; color: #065f46;">What this means:</p>
          <ul style="margin: 0; padding-left: 20px; ${baseStyles} font-size: 15px; color: #065f46;">
            <li style="margin-bottom: 8px;">Your account is now significantly more secure</li>
            <li style="margin-bottom: 8px;">You'll need a verification code from your authenticator app when signing in</li>
            <li>This helps protect your account from unauthorized access</li>
          </ul>
        </div>
        <p style="margin: 24px 0 0; ${baseStyles} font-size: 16px;">You can manage your security settings anytime from your profile.</p>
      `;
      buttonText = 'Manage Security';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = `
        <div style="background-color: #fef3c7; padding: 16px; border-left: 3px solid #f59e0b; border-radius: 4px; margin-top: 32px;">
          <p style="margin: 0; ${baseStyles} font-size: 14px; color: #92400e;">
            <strong>Didn't enable this?</strong> If you didn't enable 2FA, please contact us immediately at <a href="mailto:${supportEmail}" style="color: #107DFF; text-decoration: none; font-weight: 600;">${supportEmail}</a> so we can secure your account.
          </p>
        </div>
      `;
      break;

    case '2fa-disabled':
      content = `
        <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">Two-factor authentication (2FA) has been disabled for your ${appName} account.</p>
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 6px; border: 1px solid #f59e0b; margin: 24px 0;">
          <p style="margin: 0 0 12px; ${baseStyles} font-size: 15px; font-weight: 600; color: #92400e;">Important Security Note:</p>
          <p style="margin: 0; ${baseStyles} font-size: 15px; color: #92400e;">
            Your account security level has been reduced. We strongly recommend re-enabling 2FA to protect your account and funds.
          </p>
        </div>
        <p style="margin: 24px 0 0; ${baseStyles} font-size: 16px;">You can re-enable 2FA anytime from your profile security settings.</p>
      `;
      buttonText = 'Re-enable 2FA';
      buttonUrl = `${appUrl}/profile`;
      additionalInfo = `
        <div style="background-color: #fef3c7; padding: 16px; border-left: 3px solid #f59e0b; border-radius: 4px; margin-top: 32px;">
          <p style="margin: 0; ${baseStyles} font-size: 14px; color: #92400e;">
            <strong>Security Alert:</strong> If you didn't disable 2FA, please contact us immediately at <a href="mailto:${supportEmail}" style="color: #107DFF; text-decoration: none; font-weight: 600;">${supportEmail}</a> so we can secure your account right away.
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
        <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;"><strong>${inviterName}</strong> has invited you to join a wager on ${appName}.</p>
        
        <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; ${baseStyles} font-size: 18px; font-weight: 700; color: #1f2937;">${wagerTitle}</h3>
          ${wagerDescription ? `<p style="margin: 0 0 20px; ${baseStyles} font-size: 15px; color: #4b5563; line-height: 1.6;">${wagerDescription}</p>` : ''}
          
          <div style="display: table; width: 100%; margin: 20px 0;">
            <div style="display: table-row;">
              <div style="display: table-cell; padding: 12px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px 0 0 6px; width: 50%;">
                <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Side A</p>
                <p style="margin: 0; ${baseStyles} font-size: 16px; font-weight: 600; color: #1f2937;">${sideA}</p>
              </div>
              <div style="display: table-cell; padding: 12px; background-color: #ffffff; border: 1px solid #e5e7eb; border-left: none; border-radius: 0 6px 6px 0; width: 50%;">
                <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Side B</p>
                <p style="margin: 0; ${baseStyles} font-size: 16px; font-weight: 600; color: #1f2937;">${sideB}</p>
              </div>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <div style="display: table; width: 100%;">
              <div style="display: table-row;">
                <div style="display: table-cell; padding-right: 24px;">
                  <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Wager Amount</p>
                  <p style="margin: 0; ${baseStyles} font-size: 18px; font-weight: 700; color: #107DFF;">${formatCurrency(amount)}</p>
                </div>
                ${deadline ? `
                <div style="display: table-cell;">
                  <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Deadline</p>
                  <p style="margin: 0; ${baseStyles} font-size: 16px; font-weight: 600; color: #1f2937;">${deadline}</p>
                </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
        
        <p style="margin: 24px 0 0; ${baseStyles} font-size: 16px;">Join ${appName} to participate in this wager and compete for exciting rewards!</p>
      `;
      buttonText = 'Join Wager';
      buttonUrl = wagerInviteUrl;
      additionalInfo = `
        <p style="margin: 32px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; ${baseStyles} font-size: 14px; color: #6b7280;">
          Don't have an account? <a href="${appUrl}/wagers?signup=true" style="color: #107DFF; text-decoration: none; font-weight: 500;">Sign up for free</a> to join this wager and start competing!
        </p>
      `;
      break;

    case 'quiz-invitation':
      const quizInviterName = data.inviterName || 'Someone';
      const quizTitle = data.quizTitle || 'a quiz';
      const quizDescription = data.quizDescription || '';
      const entryFee = data.entryFeePerQuestion || 0;
      const totalQuestions = data.totalQuestions || 0;
      const maxParticipants = data.maxParticipants || 0;
      const endDate = data.endDate ? new Date(data.endDate).toLocaleDateString() : '';
      const quizInviteUrl = data.quizUrl || `${appUrl}/quizzes`;
      const totalCost = entryFee * totalQuestions;
      
      content = `
        <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;"><strong>${quizInviterName}</strong> has invited you to participate in a quiz on ${appName}.</p>
        
        <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; ${baseStyles} font-size: 18px; font-weight: 700; color: #1f2937;">${quizTitle}</h3>
          ${quizDescription ? `<p style="margin: 0 0 20px; ${baseStyles} font-size: 15px; color: #4b5563; line-height: 1.6;">${quizDescription}</p>` : ''}
          
          <div style="display: table; width: 100%; margin: 20px 0;">
            <div style="display: table-row;">
              <div style="display: table-cell; padding: 12px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px 0 0 0; width: 33.33%;">
                <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Questions</p>
                <p style="margin: 0; ${baseStyles} font-size: 16px; font-weight: 600; color: #1f2937;">${totalQuestions}</p>
              </div>
              <div style="display: table-cell; padding: 12px; background-color: #ffffff; border: 1px solid #e5e7eb; border-left: none; width: 33.33%;">
                <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Entry Fee</p>
                <p style="margin: 0; ${baseStyles} font-size: 14px; font-weight: 600; color: #1f2937;">${formatCurrency(entryFee)} per question</p>
              </div>
              <div style="display: table-cell; padding: 12px; background-color: #ffffff; border: 1px solid #e5e7eb; border-left: none; border-radius: 0 6px 0 0; width: 33.33%;">
                <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Participants</p>
                <p style="margin: 0; ${baseStyles} font-size: 16px; font-weight: 600; color: #1f2937;">Up to ${maxParticipants}</p>
              </div>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <div style="display: table; width: 100%;">
              <div style="display: table-row;">
                <div style="display: table-cell; padding-right: 24px;">
                  <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Cost</p>
                  <p style="margin: 0; ${baseStyles} font-size: 18px; font-weight: 700; color: #107DFF;">${formatCurrency(totalCost)}</p>
                </div>
                ${endDate ? `
                <div style="display: table-cell;">
                  <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">End Date</p>
                  <p style="margin: 0; ${baseStyles} font-size: 16px; font-weight: 600; color: #1f2937;">${endDate}</p>
                </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
        
        <p style="margin: 24px 0 0; ${baseStyles} font-size: 16px;">Join ${appName} to participate in this quiz and compete for exciting rewards!</p>
      `;
      buttonText = 'Take Quiz';
      buttonUrl = quizInviteUrl;
      additionalInfo = `
        <p style="margin: 32px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; ${baseStyles} font-size: 14px; color: #6b7280;">
          Don't have an account? <a href="${appUrl}/wagers?signup=true" style="color: #107DFF; text-decoration: none; font-weight: 500;">Sign up for free</a> to join this quiz and start competing!
        </p>
      `;
      break;

    case 'quiz-settlement':
      const settlementQuizTitle = data.quizTitle || 'a quiz';
      const settlementQuizUrl = data.quizUrl || `${appUrl}/quizzes`;
      const quizWon = data.won === true;
      const quizWinnings = data.amount || 0;
      const quizRank = data.rank;
      
      if (quizWon && quizWinnings > 0) {
        content = `
          <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">Congratulations! The quiz <strong>"${settlementQuizTitle}"</strong> has been settled, and you're a winner! 🎉</p>
          
          <div style="background-color: #d1fae5; padding: 24px; border-radius: 8px; border: 1px solid #10b981; margin: 24px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
              <p style="margin: 0 0 8px; ${baseStyles} font-size: 14px; color: #065f46; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Winnings</p>
              <p style="margin: 0; ${baseStyles} font-size: 32px; font-weight: 700; color: #10b981;">${formatCurrency(quizWinnings)}</p>
            </div>
            ${quizRank ? `
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #10b981;">
              <p style="margin: 0 0 8px; ${baseStyles} font-size: 14px; color: #065f46; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Rank</p>
              <p style="margin: 0; ${baseStyles} font-size: 24px; font-weight: 700; color: #065f46;">#${quizRank}</p>
            </div>
            ` : ''}
          </div>
          
          <p style="margin: 24px 0 0; ${baseStyles} font-size: 16px;">Your winnings have been added to your account balance. You can view the full results and leaderboard by clicking the button below.</p>
        `;
        buttonText = 'View Quiz Results';
        buttonUrl = settlementQuizUrl;
        additionalInfo = '';
      } else {
        content = `
          <p style="margin: 0 0 16px; ${baseStyles} font-size: 16px;">The quiz <strong>"${settlementQuizTitle}"</strong> has been settled.</p>
          
          <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="margin: 0 0 12px; ${baseStyles} font-size: 15px; color: #4b5563;">Thank you for participating! While you didn't win this time, we hope you enjoyed the quiz.</p>
            ${quizRank ? `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 6px; ${baseStyles} font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Rank</p>
              <p style="margin: 0; ${baseStyles} font-size: 18px; font-weight: 600; color: #1f2937;">#${quizRank}</p>
            </div>
            ` : ''}
          </div>
          
          <p style="margin: 24px 0 0; ${baseStyles} font-size: 16px;">You can view the full results and leaderboard by clicking the button below.</p>
        `;
        buttonText = 'View Quiz Results';
        buttonUrl = settlementQuizUrl;
        additionalInfo = '';
      }
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
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; ${baseStyles} font-size: 24px; font-weight: 700; color: #1f2937; letter-spacing: -0.5px;">${appName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px; ${baseStyles} font-size: 22px; font-weight: 700; color: #1f2937; letter-spacing: -0.3px;">
                ${getEmailSubject(type)}
              </h2>
              
              <p style="margin: 0 0 20px; ${baseStyles} font-size: 16px; color: #4b5563;">
                Hi ${name},
              </p>
              
              <div style="${baseStyles} font-size: 16px; color: #4b5563;">
                ${content}
              </div>
              
              ${buttonUrl ? `
              <div style="text-align: center; margin: 32px 0;">
                <a href="${buttonUrl}" style="${buttonStyles}">${buttonText}</a>
              </div>
              ` : ''}
              
              ${additionalInfo}
              
              <div style="border-top: 1px solid #e5e7eb; margin: 40px 0 24px; padding-top: 24px;">
                <p style="margin: 0 0 8px; ${baseStyles} font-size: 15px; color: #4b5563; font-weight: 500;">
                  Best regards,
                </p>
                <p style="margin: 0; ${baseStyles} font-size: 15px; color: #107DFF; font-weight: 600;">
                  The ${appName} Team
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; ${baseStyles} font-size: 13px; color: #6b7280;">
                This email was sent to <a href="mailto:${recipientEmail}" style="color: #107DFF; text-decoration: none;">${recipientEmail}</a>
              </p>
              <p style="margin: 0 0 16px; ${baseStyles} font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; ${baseStyles} font-size: 12px; color: #9ca3af;">
                  <a href="${appUrl}" style="color: #107DFF; text-decoration: none; margin-right: 16px;">Visit Website</a>
                  <a href="mailto:${supportEmail}" style="color: #107DFF; text-decoration: none;">Contact Support</a>
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
  const appName = 'wagered.app';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';
  const currency = (process.env.DEFAULT_CURRENCY || 'NGN') as 'NGN' | 'USD' | 'GBP' | 'EUR';
  
  const formatCurrencyText = (amount: number, curr: string = currency) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

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

    case 'quiz-invitation':
      const quizInviterNameText = data.inviterName || 'Someone';
      const quizTitleText = data.quizTitle || 'a quiz';
      const quizDescriptionText = data.quizDescription || '';
      const entryFeeText = data.entryFeePerQuestion || 0;
      const totalQuestionsText = data.totalQuestions || 0;
      const maxParticipantsText = data.maxParticipants || 0;
      const endDateText = data.endDate ? new Date(data.endDate).toLocaleDateString() : '';
      const quizUrlText = data.quizUrl || `${appUrl}/quizzes`;
      const totalCostText = entryFeeText * totalQuestionsText;
      content = `Hi ${name},\n\n${quizInviterNameText} has invited you to participate in a quiz on ${appName}!\n\nQuiz: ${quizTitleText}\n${quizDescriptionText ? `Description: ${quizDescriptionText}\n` : ''}\nQuestions: ${totalQuestionsText}\nEntry Fee: ${formatCurrencyText(entryFeeText)} per question\nTotal Cost: ${formatCurrencyText(totalCostText)}\nMax Participants: ${maxParticipantsText}\n${endDateText ? `End Date: ${endDateText}\n` : ''}\nTake quiz now: ${quizUrlText}\n\nDon't have an account? Sign up for free at ${appUrl}/wagers?signup=true\n\nBest regards,\nThe ${appName} Team`;
      break;

    case 'quiz-settlement':
      const settlementQuizTitleText = data.quizTitle || 'a quiz';
      const settlementQuizUrlText = data.quizUrl || `${appUrl}/quizzes`;
      const quizWonText = data.won === true;
      const quizWinningsText = data.amount || 0;
      const quizRankText = data.rank;
      
      if (quizWonText && quizWinningsText > 0) {
        content = `Hi ${name},\n\nCongratulations! The quiz "${settlementQuizTitleText}" has been settled, and you're a winner! 🎉\n\nYour Winnings: ${formatCurrencyText(quizWinningsText)}\n${quizRankText ? `Your Rank: #${quizRankText}\n` : ''}\nYour winnings have been added to your account balance. View full results: ${settlementQuizUrlText}\n\nBest regards,\nThe ${appName} Team`;
      } else {
        content = `Hi ${name},\n\nThe quiz "${settlementQuizTitleText}" has been settled.\n\nThank you for participating! While you didn't win this time, we hope you enjoyed the quiz.\n${quizRankText ? `Your Rank: #${quizRankText}\n` : ''}\nView full results: ${settlementQuizUrlText}\n\nBest regards,\nThe ${appName} Team`;
      }
      break;

    case 'kyc-approved':
      const kycLevelText = data.kycLevel || 1;
      const kycLevelLabelText = data.kycLevelLabel || `Level ${kycLevelText}`;
      content = `Hi ${name},\n\nCongratulations! Your KYC verification has been approved.\n\nYour New Verification Level: ${kycLevelLabelText}\n\nYour account has been successfully upgraded to ${kycLevelLabelText}. You now have access to additional features and higher transaction limits.\n\nView your account: ${appUrl}/profile\n\nBest regards,\nThe ${appName} Team`;
      break;

    case 'kyc-rejected':
      const rejectionReasonText = data.rejectionReason || 'Your submission did not meet our verification requirements.';
      const supportEmailText = process.env.SUPPORT_EMAIL || 'support@wagered.app';
      content = `Hi ${name},\n\nWe regret to inform you that your KYC verification has been rejected.\n\nRejection Reason:\n${rejectionReasonText}\n\nYou can submit a new KYC application from your profile page. Please ensure all information is accurate and all required documents are clear and valid.\n\nSubmit new application: ${appUrl}/profile\n\nNeed help? Contact our support team at ${supportEmailText}.\n\nBest regards,\nThe ${appName} Team`;
      break;
  }

  return content;
}
