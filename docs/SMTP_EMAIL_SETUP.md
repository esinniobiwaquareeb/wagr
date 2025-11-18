# SMTP Email Configuration

## Overview

The wagr platform uses SMTP for sending emails. Configure your SMTP settings via environment variables.

## Environment Variables

Add these to your `.env.local` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=wagr <noreply@wagr.app>
SMTP_REJECT_UNAUTHORIZED=true
```

## Common SMTP Providers

### Gmail

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=wagr <your-email@gmail.com>
```

**Note**: For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password (not your regular password)

### Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM=wagr <your-email@outlook.com>
```

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=wagr <noreply@wagr.app>
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM=wagr <noreply@wagr.app>
```

### Custom SMTP Server

```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
SMTP_FROM=wagr <noreply@yourdomain.com>
```

## Port Configuration

- **Port 587**: STARTTLS (recommended for most providers)
- **Port 465**: SSL/TLS (some providers use this)
- **Port 25**: Usually blocked by ISPs, not recommended

## Security Settings

- `SMTP_REJECT_UNAUTHORIZED=true`: Reject unauthorized certificates (recommended for production)
- `SMTP_REJECT_UNAUTHORIZED=false`: Allow self-signed certificates (development only)

## Testing

Use the test endpoint to verify your SMTP configuration:

```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

Or test via the API:

```typescript
import { sendWelcomeEmail } from '@/lib/email-service';

await sendWelcomeEmail('test@example.com', 'Test User');
```

## Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Check username and password
   - For Gmail, ensure you're using an App Password, not your regular password
   - Verify 2FA is enabled (for Gmail)

2. **"Connection timeout"**
   - Check SMTP_HOST and SMTP_PORT
   - Verify firewall/network allows SMTP connections
   - Try port 465 instead of 587

3. **"Certificate verification failed"**
   - Set `SMTP_REJECT_UNAUTHORIZED=false` for development
   - For production, ensure your SMTP server has valid SSL certificates

4. **"Email not received"**
   - Check spam folder
   - Verify SMTP_FROM address is valid
   - Check SMTP server logs
   - Verify recipient email is correct

### Debug Mode

Enable detailed logging by checking server logs. The email service logs:
- Successful sends with message IDs
- Errors with detailed messages
- Configuration warnings

## Production Recommendations

1. Use a dedicated email service (SendGrid, Mailgun, etc.) for better deliverability
2. Set up SPF, DKIM, and DMARC records for your domain
3. Use a verified sender address
4. Monitor bounce rates and spam complaints
5. Implement rate limiting to prevent abuse
6. Use environment variables, never hardcode credentials

## Email Templates

All emails use the template system in `lib/email-templates.ts`. Customize:
- Colors and branding
- Content and messaging
- HTML structure
- Plain text fallback

