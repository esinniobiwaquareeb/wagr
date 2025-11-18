/**
 * Test script to send an email via SMTP
 * Run with: npx tsx scripts/test-email.ts
 * 
 * Make sure your .env.local or .env file has SMTP configuration
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { sendEmail } from '../lib/email-service';
import { logger } from '../lib/logger';

async function testEmail() {
  // Change this to test with a different email
  const recipientEmail = process.env.TEST_EMAIL || 'mychat247@gmail.com';
  
  console.log('Testing email to:', recipientEmail);
  console.log('SMTP Configuration:');
  console.log('  SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
  console.log('  SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
  console.log('  SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
  console.log('  SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '***SET***' : 'NOT SET');
  console.log('  SMTP_FROM:', process.env.SMTP_FROM || 'NOT SET');
  console.log('');

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.error('❌ SMTP configuration is incomplete!');
    console.error('Please set the following environment variables:');
    console.error('  - SMTP_HOST');
    console.error('  - SMTP_USER');
    console.error('  - SMTP_PASSWORD');
    console.error('  - SMTP_PORT (optional, defaults to 587)');
    console.error('  - SMTP_FROM (optional)');
    process.exit(1);
  }

  try {
    const result = await sendEmail({
      to: recipientEmail,
      type: 'welcome',
      data: {
        recipientName: 'Test User',
        loginUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app',
      },
      subject: 'Test Email from wagr - SMTP Test',
    });

    if (result) {
      console.log('✅ Email sent successfully!');
      console.log('Check your inbox at:', recipientEmail);
      console.log('(Also check spam folder if not in inbox)');
    } else {
      console.error('❌ Failed to send email');
      console.error('Check the logs above for error details');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

testEmail();

