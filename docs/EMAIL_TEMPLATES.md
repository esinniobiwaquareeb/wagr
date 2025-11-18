# Email Templates System

## Overview

The wagr platform includes a comprehensive, reusable email template system that can be used for all email communications including verification, welcome, password reset, password change notifications, and 2FA updates.

## Email Template Library

Location: `lib/email-templates.ts`

### Supported Email Types

1. **verification** - Email verification for new accounts
2. **welcome** - Welcome email for new users
3. **password-reset** - Password reset request
4. **password-changed** - Notification when password is changed
5. **2fa-enabled** - Notification when 2FA is enabled
6. **2fa-disabled** - Notification when 2FA is disabled

### Usage

```typescript
import { generateEmailHTML, generateEmailText, getEmailSubject } from '@/lib/email-templates';

const emailData = {
  type: 'verification',
  recipientEmail: 'user@example.com',
  recipientName: 'John Doe', // Optional
  verificationUrl: 'https://wagr.app/verify?token=...',
};

const htmlContent = generateEmailHTML(emailData);
const textContent = generateEmailText(emailData);
const subject = getEmailSubject(emailData.type);
```

### Template Features

- **Responsive Design**: Works on all email clients
- **Branded**: Uses wagr branding and colors
- **Accessible**: Proper HTML structure and alt text
- **Fallback**: Plain text version available
- **Customizable**: Easy to modify colors, fonts, and content

## Supabase Email Configuration

### Setting Up Custom Email Templates

1. Go to your Supabase Dashboard
2. Navigate to Authentication > Email Templates
3. Customize templates using the HTML from `generateEmailHTML()`

### Email Template Variables

Supabase provides these variables:
- `{{ .ConfirmationURL }}` - Email verification link
- `{{ .Token }}` - Reset token
- `{{ .TokenHash }}` - Hashed token
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email
- `{{ .RedirectTo }}` - Redirect URL after action

### Recommended Configuration

1. **Email Verification Template**:
   - Use `generateEmailHTML()` with type `'verification'`
   - Replace `{{ .ConfirmationURL }}` with your verification link

2. **Password Reset Template**:
   - Use `generateEmailHTML()` with type `'password-reset'`
   - Replace `{{ .Token }}` or use `{{ .ConfirmationURL }}` for reset link

3. **Magic Link Template** (if using):
   - Similar to verification template

## Integration with Email Service

### Option 1: Supabase Built-in (Current)

Supabase handles email sending automatically for:
- Email verification
- Password reset
- Magic links

The templates in `lib/email-templates.ts` can be used to customize Supabase email templates in the dashboard.

### Option 2: Custom Email Service (Future)

If you want to use a custom email service (SendGrid, Resend, etc.):

```typescript
// Example with Resend
import { Resend } from 'resend';
import { generateEmailHTML, getEmailSubject } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(data: EmailTemplateData) {
  await resend.emails.send({
    from: 'wagr <noreply@wagr.app>',
    to: data.recipientEmail,
    subject: getEmailSubject(data.type),
    html: generateEmailHTML(data),
    text: generateEmailText(data),
  });
}
```

## Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_APP_URL=https://wagr.app
SUPPORT_EMAIL=support@wagr.app
```

## Customization

### Changing Colors

Edit the template in `lib/email-templates.ts`:
- Primary color: `#0070f3`
- Success color: `#10b981`
- Error color: `#d32f2f`

### Changing Branding

Update:
- `appName` variable
- Logo/header section
- Footer content

### Adding New Email Types

1. Add type to `EmailType` union
2. Add subject to `getEmailSubject()`
3. Add content to `generateEmailHTML()` switch statement
4. Add text version to `generateEmailText()`

## Testing

To test email templates locally:

```typescript
// Create a test file: scripts/test-email.ts
import { generateEmailHTML, generateEmailText } from '../lib/email-templates';

const testData = {
  type: 'welcome',
  recipientEmail: 'test@example.com',
  recipientName: 'Test User',
  loginUrl: 'https://wagr.app/wagers',
};

console.log('HTML:', generateEmailHTML(testData));
console.log('Text:', generateEmailText(testData));
```

## Security Notes

- Never include sensitive information in email templates
- Use HTTPS for all links
- Set appropriate expiration times for reset links
- Always validate tokens server-side
- Use rate limiting for password reset requests

