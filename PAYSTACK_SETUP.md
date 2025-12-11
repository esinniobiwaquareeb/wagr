# Paystack Integration Setup

This application uses Paystack for processing deposits. Follow these steps to set up Paystack:

## 1. Get Your Paystack API Keys

1. Sign up or log in to your [Paystack Dashboard](https://dashboard.paystack.com/)
2. Navigate to **Settings** > **API Keys & Webhooks**
3. Copy your **Secret Key** (starts with `sk_`)

## 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx  # Use sk_live_ for production
NEXT_PUBLIC_APP_URL=https://your-domain.com  # Your production URL
```

## 3. Configure Webhook URL

1. In your Paystack Dashboard, go to **Settings** > **API Keys & Webhooks**
2. Click **Add Webhook URL**
3. Add your webhook URL:
   - **Development**: `http://localhost:3000/api/payments/webhook` (use ngrok or similar for testing)
   - **Production**: `https://your-domain.com/api/payments/webhook`
4. Select the following events:
   - `charge.success`
   - `charge.failed` (optional, for handling failures)

## 4. Test the Integration

### Test Mode
- Use test API keys (starts with `sk_test_`)
- Use Paystack test cards:
  - **Success**: `4084084084084081`
  - **Decline**: `5060666666666666666`
  - **Insufficient Funds**: `5060666666666666667`

### Production Mode
- Use live API keys (starts with `sk_live_`)
- Real payments will be processed

## 5. Payment Flow

1. User enters deposit amount (minimum ₦100)
2. User clicks "Deposit" button
3. Application calls `/api/payments/initialize` to create a Paystack transaction
4. User is redirected to Paystack checkout page
5. User completes payment on Paystack
6. Paystack redirects to `/api/payments/verify` with transaction reference
7. Application verifies payment with Paystack API
8. If successful:
   - User balance is updated
   - Transaction record is created
   - User is redirected to wallet page with success message
9. Paystack also sends webhook to `/api/payments/webhook` for redundancy

## 6. Security Notes

- Never expose your secret key in client-side code
- Always verify webhook signatures
- Use HTTPS in production
- Validate all payment amounts server-side
- Implement rate limiting on payment endpoints

## 7. Troubleshooting

### Payment not initializing
- Check that `PAYSTACK_SECRET_KEY` is set correctly
- Verify the API key is active in Paystack dashboard
- Check browser console for errors

### Webhook not receiving events
- Verify webhook URL is correctly configured in Paystack dashboard
- Ensure your server is accessible from the internet (use ngrok for local testing)
- Check server logs for webhook requests

### Payment verified but balance not updated
- Check database connection
- Verify `increment_balance` function exists in Supabase
- Check transaction logs in Supabase

## 8. Currency Support

Currently configured for Nigerian Naira (NGN). To support other currencies:

1. Update currency conversion in `/api/payments/initialize/route.ts`
2. Paystack supports multiple currencies - check their documentation
3. Update minimum deposit amount validation in `app/wallet/page.tsx`

