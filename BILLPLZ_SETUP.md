# Billplz Payment Integration Setup Guide

This guide will help you set up Billplz payment gateway for both sandbox (development) and production environments.

## Table of Contents
1. [Account Setup](#account-setup)
2. [Backend Configuration](#backend-configuration)
3. [Database Migration](#database-migration)
4. [Frontend Usage](#frontend-usage)
5. [Testing](#testing)
6. [Production Deployment](#production-deployment)

---

## 1. Account Setup

### Sandbox Account (Development)

1. **Register for Sandbox Account**
   - Go to https://www.billplz-sandbox.com
   - Click "Sign Up" and create an account
   - Verify your email address

2. **Get API Credentials**
   - Log in to your sandbox dashboard
   - Navigate to **Settings** > **API Configuration**
   - Copy the following:
     - **API Secret Key** (starts with `sk_`)
     - **Collection ID** (create a collection first if none exists)
     - **X Signature Key** (used for webhook verification)

3. **Create a Collection**
   - Go to **Collections** in the sidebar
   - Click "Create Collection"
   - Fill in the details and save
   - Copy the Collection ID

### Production Account

1. **Register for Production Account**
   - Go to https://www.billplz.com
   - Click "Get Started" and complete the registration
   - Submit required business documents for verification
   - Wait for approval (usually 1-3 business days)

2. **Get API Credentials**
   - Log in to your production dashboard
   - Navigate to **Settings** > **API Configuration**
   - Copy the same credentials as sandbox:
     - API Secret Key
     - Collection ID
     - X Signature Key

---

## 2. Backend Configuration

### Update Environment Variables

Open `backend/.env` and update the Billplz configuration:

```env
# Billplz Payment Gateway Configuration
# Set to 'sandbox' for development, 'production' for live
BILLPLZ_ENV=sandbox

# Sandbox credentials
BILLPLZ_SANDBOX_API_KEY=your_sandbox_secret_key_here
BILLPLZ_SANDBOX_COLLECTION_ID=your_sandbox_collection_id
BILLPLZ_SANDBOX_X_SIGNATURE=your_sandbox_x_signature_key

# Production credentials
BILLPLZ_PRODUCTION_API_KEY=your_production_secret_key_here
BILLPLZ_PRODUCTION_COLLECTION_ID=your_production_collection_id
BILLPLZ_PRODUCTION_X_SIGNATURE=your_production_x_signature_key

# API Base URL (for webhooks)
API_BASE_URL=http://192.168.100.251:5002

# App Deep Link Scheme (for payment redirects)
APP_SCHEME=lakeviewhaus://
```

**Important Notes:**
- Replace all `your_*_here` values with actual credentials from Billplz
- For development, set `BILLPLZ_ENV=sandbox`
- For production, set `BILLPLZ_ENV=production`
- `API_BASE_URL` should be your publicly accessible backend URL (for webhooks)
- For local development, you may need to use a tunneling service like ngrok for webhooks

---

## 3. Database Migration

Run the database migration to create the payments table:

```bash
cd backend

# Generate migration
flask db migrate -m "Add payments table"

# Apply migration
flask db upgrade
```

This will create the `payments` table with the following structure:
- User information (email, name, mobile)
- Payment details (amount, description)
- Billplz data (bill_id, url)
- Status tracking (pending, paid, failed, cancelled)
- Transaction references
- Webhook data
- Metadata (JSON)

---

## 4. Frontend Usage

### Using the Payment Modal

```typescript
import { PaymentModal } from '@/components/modals/user/PaymentModal';
import { useState } from 'react';

function MyComponent() {
    const [showPayment, setShowPayment] = useState(false);

    const handlePaymentSuccess = (payment) => {
        console.log('Payment created:', payment);
        // Handle successful payment creation
    };

    return (
        <>
            <Button
                title="Make Payment"
                onPress={() => setShowPayment(true)}
            />

            <PaymentModal
                visible={showPayment}
                onClose={() => setShowPayment(false)}
                onSuccess={handlePaymentSuccess}
                defaultAmount={50.00}  // Optional: RM 50.00
                description="Order Payment"
                metadata={{ orderId: 'ORD123' }}  // Optional
                reference_1_label="Order ID"  // Optional
                reference_1="ORD123"  // Optional
            />
        </>
    );
}
```

### Using the Payment Status Card

```typescript
import { PaymentStatusCard } from '@/components/PaymentStatusCard';

function PaymentHistoryScreen() {
    const [payments, setPayments] = useState([]);

    useEffect(() => {
        loadPayments();
    }, []);

    const loadPayments = async () => {
        try {
            const response = await api.payment.getHistory();
            setPayments(response.payments);
        } catch (error) {
            console.error('Failed to load payments:', error);
        }
    };

    return (
        <ScrollView>
            {payments.map(payment => (
                <PaymentStatusCard
                    key={payment.id}
                    payment={payment}
                    onPress={() => {
                        // Handle payment card press
                        console.log('Payment clicked:', payment);
                    }}
                />
            ))}
        </ScrollView>
    );
}
```

### API Methods

```typescript
import { api } from '@/services/api';

// Create a payment
const response = await api.payment.createBill({
    amount: 1000,  // RM 10.00 (amount in cents)
    description: 'Order payment',
    mobile: '+60123456789',  // Optional
    metadata: { orderId: 'ORD123' },  // Optional
    reference_1_label: 'Order ID',  // Optional
    reference_1: 'ORD123'  // Optional
});

// Get payment status
const status = await api.payment.getStatus(billId);

// Get payment history
const history = await api.payment.getHistory({
    page: 1,
    per_page: 20,
    status: 'paid'  // Optional: filter by status
});

// Cancel a payment
await api.payment.cancelPayment(billId);

// Get payment configuration
const config = await api.payment.getConfig();
console.log(config.environment);  // 'sandbox' or 'production'
```

---

## 5. Testing

### Testing in Sandbox Mode

1. **Set Environment to Sandbox**
   ```env
   BILLPLZ_ENV=sandbox
   ```

2. **Create a Test Payment**
   - Use the PaymentModal component
   - Enter a test amount (e.g., RM 1.00)
   - Click "Proceed to Payment"
   - You'll be redirected to Billplz sandbox payment page

3. **Test Payment Methods**
   - **FPX**: Use test bank credentials provided by Billplz
   - **Card**: Use test card numbers provided by Billplz
   - Test both successful and failed payments

4. **Verify Webhook**
   - After payment, check your database for payment status updates
   - Verify that the webhook endpoint received the callback
   - Check backend logs for any errors

### Test Credentials (Sandbox)

Billplz provides test credentials for sandbox:

**FPX Test Banks:**
- Bank: Maybank2u (TEST0021)
- Username: `test` or `test2` (for different scenarios)
- Password: (any password)

**Test Card Numbers:**
- Success: `5123450000000008`
- Failure: `5123450000000016`
- CVV: Any 3 digits
- Expiry: Any future date

---

## 6. Production Deployment

### Pre-Deployment Checklist

- [ ] Billplz production account verified and approved
- [ ] Production API credentials configured in `.env`
- [ ] `BILLPLZ_ENV=production` set in production environment
- [ ] `API_BASE_URL` set to production backend URL (must be HTTPS)
- [ ] Database migrations applied to production database
- [ ] Webhook endpoint is publicly accessible (HTTPS required)
- [ ] Test payments in sandbox completed successfully

### Switching to Production

1. **Update Environment Variable**
   ```env
   BILLPLZ_ENV=production
   ```

2. **Update API Base URL**
   ```env
   API_BASE_URL=https://your-production-api.com
   ```

3. **Verify Webhook URL**
   - Ensure your webhook endpoint is accessible at:
     `https://your-production-api.com/payment/webhook`
   - Must use HTTPS in production

4. **Test Production Integration**
   - Create a small test payment (e.g., RM 0.01)
   - Verify payment flow works end-to-end
   - Check webhook callback is received and processed
   - Verify database records are created correctly

### Important Security Notes

1. **Never commit API keys to git**
   - Keep `.env` file in `.gitignore`
   - Use environment variables in production

2. **Always verify X-Signature**
   - The webhook handler automatically verifies signatures
   - Never skip signature verification in production

3. **Use HTTPS in Production**
   - Billplz requires HTTPS for production webhooks
   - SSL certificate must be valid

4. **Validate Amount on Backend**
   - Always validate payment amounts on the backend
   - Never trust frontend-provided amounts alone

---

## Payment Flow Diagram

```
User App                    Backend                    Billplz
   |                           |                          |
   |-- Create Payment -------->|                          |
   |                           |-- Create Bill ---------->|
   |                           |<-- Bill URL -------------|
   |<-- Bill URL --------------|                          |
   |                           |                          |
   |-- Open Bill URL ---------------------------------->|
   |                                                      |
   |<-- Payment Page (FPX/Card) ------------------------|
   |                                                      |
   |-- Complete Payment -------------------------------->|
   |                           |                          |
   |                           |<-- Webhook Callback -----|
   |                           |                          |
   |                           |-- Update DB Status ------|
   |                           |                          |
   |<-- Redirect to App --------------------------------|
   |                           |                          |
   |-- Check Payment Status -->|                          |
   |<-- Payment Result --------|                          |
```

---

## API Endpoints

### Backend Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/payment/create-bill` | POST | Yes | Create a new payment |
| `/payment/webhook` | POST | No | Webhook callback from Billplz |
| `/payment/status/:bill_id` | GET | Yes | Get payment status |
| `/payment/history` | GET | Yes | Get payment history |
| `/payment/cancel/:bill_id` | DELETE | Yes | Cancel a payment |
| `/payment/config` | GET | No | Get payment configuration |

---

## Troubleshooting

### Webhook Not Receiving Callbacks

1. **Check API Base URL**
   - Ensure `API_BASE_URL` is set correctly
   - Must be publicly accessible (use ngrok for local testing)

2. **Verify Webhook URL Format**
   - Should be: `https://your-domain.com/payment/webhook`
   - Must use HTTPS in production

3. **Check X-Signature**
   - Verify `BILLPLZ_*_X_SIGNATURE` is correct
   - Check backend logs for signature verification errors

### Payment Creation Fails

1. **Check API Credentials**
   - Verify API keys are correct
   - Ensure Collection ID exists
   - Check if credentials match the environment (sandbox/production)

2. **Check Amount Format**
   - Amount must be in cents (integer)
   - Example: RM 10.00 = 1000 cents

3. **Check Backend Logs**
   - Look for error messages in Flask console
   - Check for network errors

### Database Errors

1. **Run Migrations**
   ```bash
   flask db upgrade
   ```

2. **Check Database Connection**
   - Verify `DATABASE_URL` in `.env`
   - Ensure PostgreSQL is running

---

## Support

- **Billplz Documentation**: https://www.billplz.com/api
- **Billplz Support**: support@billplz.com
- **Sandbox Dashboard**: https://www.billplz-sandbox.com
- **Production Dashboard**: https://www.billplz.com

---

## Next Steps

After completing the setup:

1. Test the integration in sandbox mode
2. Implement your business logic in the webhook handler
3. Create a payment history screen for users
4. Add payment notifications
5. Implement refund functionality if needed
6. Move to production when ready
