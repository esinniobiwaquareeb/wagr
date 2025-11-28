# Supabase Email Templates Setup

This guide explains how to customize Supabase's built-in email templates for user registration (verification) and password reset.

## Overview

Supabase handles authentication emails automatically, but you can customize the templates in the Supabase Dashboard. These templates use HTML and support variables.

## Accessing Email Templates

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Email Templates**
4. You'll see templates for:
   - **Confirm signup** (Registration/Verification email)
   - **Magic Link** (if enabled)
   - **Change Email Address**
   - **Reset Password** (Forgot password)

## Template Variables

Supabase provides these variables you can use in templates:

- `{{ .ConfirmationURL }}` - The verification/reset link
- `{{ .Email }}` - User's email address
- `{{ .Token }}` - The verification token (if needed)
- `{{ .TokenHash }}` - Hashed token
- `{{ .SiteURL }}` - Your site URL
- `{{ .RedirectTo }}` - Redirect URL after action

## 1. Confirm Signup (Registration Email) Template

**Subject:**
```
Verify your wagr account
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your wagr account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #107DFF 0%, #0D6EFD 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">wagr</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a;">
                Verify your email address
              </h2>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">
                Thanks for signing up for wagr! To get started, please verify your email address by clicking the button below.
              </p>
              
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #666666;">
                This link will expire in 24 hours for security reasons.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #107DFF; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Verify Email Address
                </a>
              </div>
              
              <!-- Fallback Link -->
              <p style="font-size: 14px; color: #666666; margin-top: 24px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #107DFF; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">
              
              <p style="margin: 0; font-size: 14px; color: #666666;">
                Best regards,<br>
                The wagr Team
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; text-align: center; background-color: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #999999;">
                This email was sent to {{ .Email }}
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2025 wagr. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## 2. Reset Password (Forgot Password) Template

**Subject:**
```
Reset your wagr password
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your wagr password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #107DFF 0%, #0D6EFD 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">wagr</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a;">
                Reset your password
              </h2>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">
                We received a request to reset your password for your wagr account ({{ .Email }}).
              </p>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;">
                Click the button below to reset your password. This link will expire in 1 hour for security reasons.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #107DFF; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Reset Password
                </a>
              </div>
              
              <!-- Security Notice -->
              <p style="margin: 24px 0 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; font-size: 14px; color: #856404; border-radius: 4px;">
                <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email and your password will remain unchanged.
              </p>
              
              <!-- Fallback Link -->
              <p style="font-size: 14px; color: #666666; margin-top: 24px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #107DFF; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">
              
              <p style="margin: 0; font-size: 14px; color: #666666;">
                Best regards,<br>
                The wagr Team
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; text-align: center; background-color: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #999999;">
                This email was sent to {{ .Email }}
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2025 wagr. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## 3. Change Email Address Template

**Subject:**
```
Confirm your new email address
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your new email address</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #107DFF 0%, #0D6EFD 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">wagr</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a;">
                Confirm your new email address
              </h2>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">
                You requested to change your email address to {{ .Email }}.
              </p>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;">
                Click the button below to confirm this change. This link will expire in 24 hours.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #107DFF; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Confirm Email Change
                </a>
              </div>
              
              <!-- Security Notice -->
              <p style="margin: 24px 0 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; font-size: 14px; color: #856404; border-radius: 4px;">
                <strong>⚠️ Security Notice:</strong> If you didn't request this email change, please ignore this email and contact support immediately.
              </p>
              
              <!-- Fallback Link -->
              <p style="font-size: 14px; color: #666666; margin-top: 24px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #107DFF; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">
              
              <p style="margin: 0; font-size: 14px; color: #666666;">
                Best regards,<br>
                The wagr Team
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; text-align: center; background-color: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #999999;">
                This email was sent to {{ .Email }}
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2025 wagr. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Setup Instructions

### Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Authentication** in the left sidebar
4. Click **Email Templates** tab

### Step 2: Update Each Template
1. Click on the template you want to customize (e.g., "Confirm signup")
2. Update the **Subject** field with the subject line provided above
3. Update the **Body** field with the HTML template provided above
4. Click **Save**

### Step 3: Configure Redirect URLs
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL (e.g., `https://wagr.app`)
3. Add **Redirect URLs**:
   - `http://localhost:3000/**` (for development)
   - `https://wagr.app/**` (for production)
   - `https://wagr.app/reset-password` (for password reset)

### Step 4: Test the Templates
1. Try signing up a new user to test the verification email
2. Try the "Forgot password" flow to test the reset email
3. Check that emails are received and links work correctly

## Important Notes

1. **Template Variables**: Use `{{ .VariableName }}` syntax (with spaces around the dot)
2. **HTML Support**: Templates support full HTML and inline CSS
3. **Link Expiration**: 
   - Verification links expire in 24 hours (configurable in Auth settings)
   - Password reset links expire in 1 hour (configurable)
4. **Custom SMTP**: If you want to use your own SMTP (instead of Supabase's), you can configure it in **Project Settings** → **Auth** → **SMTP Settings**

## Customization Tips

- **Colors**: Change `#107DFF` to your brand color
- **Logo**: Add an `<img>` tag in the header if you have a logo
- **Fonts**: The templates use system fonts for best compatibility
- **Responsive**: The templates are mobile-friendly with responsive tables

## Troubleshooting

1. **Emails not sending**: Check SMTP configuration in Project Settings
2. **Links not working**: Verify Redirect URLs are configured correctly
3. **Styling issues**: Ensure inline CSS is used (external stylesheets may not work)
4. **Variables not replacing**: Check that you're using `{{ .VariableName }}` with spaces

## Alternative: Use Custom SMTP

If you prefer to use your own SMTP server (like Gmail) instead of Supabase's:

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Enter your SMTP credentials:
   - Host: `smtp.gmail.com`
   - Port: `587` or `465`
   - Username: Your email
   - Password: Your app password
   - Sender email: Your verified email
   - Sender name: `wagr`

This way, emails will be sent from your SMTP server but still use the templates you configure in Supabase.

