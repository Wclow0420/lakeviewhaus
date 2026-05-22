# Billplz Integration - Quick Start

## What Was Added

✅ **Backend:**
- `app/services/billplz_service.py` - Billplz API integration service
- `app/models/payment.py` - Payment database model
- `app/routes/payment.py` - Payment API endpoints

✅ **Frontend:**
- `services/api.ts` - Payment API methods
- `components/modals/user/PaymentModal.tsx` - Payment checkout modal
- `components/PaymentStatusCard.tsx` - Payment history card component

✅ **Configuration:**
- `backend/.env` - Billplz credentials (needs to be filled)
- `BILLPLZ_SETUP.md` - Comprehensive setup guide

---

## Quick Setup (5 Minutes)

### 1. Get Billplz Sandbox Credentials

1. Go to https://www.billplz-sandbox.com and sign up
2. Navigate to **Settings** > **API Configuration**
3. Copy your:
   - API Secret Key
   - X Signature Key
4. Create a **Collection** and copy the Collection ID

### 2. Update Backend Configuration

Edit `backend/.env`:

```env
# Change this
BILLPLZ_ENV=sandbox

# Add your sandbox credentials
BILLPLZ_SANDBOX_API_KEY=your_api_key_here
BILLPLZ_SANDBOX_COLLECTION_ID=your_collection_id_here
BILLPLZ_SANDBOX_X_SIGNATURE=your_x_signature_here

# For local development (use ngrok for webhook testing)
API_BASE_URL=http://192.168.100.251:5002
APP_SCHEME=lakeviewhaus://
```

### 3. Run Database Migration

```bash
cd backend
flask db migrate -m "Add payments table"
flask db upgrade
```

### 4. Restart Backend

```bash
python main.py
```

---

## Test the Integration

### Option 1: Use the Payment Modal Component

```tsx
import { PaymentModal } from '@/components/modals/user/PaymentModal';

const [showPayment, setShowPayment] = useState(false);

<PaymentModal
    visible={showPayment}
    onClose={() => setShowPayment(false)}
    defaultAmount={10.00}  // RM 10.00
    description="Test Payment"
    onSuccess={(payment) => {
        console.log('Payment created:', payment);
    }}
/>
```

### Option 2: Direct API Call

```typescript
import { api } from '@/services/api';

const response = await api.payment.createBill({
    amount: 1000,  // RM 10.00 (in cents)
    description: 'Test payment',
});

console.log('Bill URL:', response.bill_url);
```

### Test Payment in Sandbox

1. Click "Proceed to Payment"
2. You'll be redirected to Billplz sandbox
3. Use test credentials:
   - Bank: Maybank2u (TEST0021)
   - Username: `test`
   - Password: (any)
4. Complete the payment
5. Check your database - payment status should update to "paid"

---

## Available API Endpoints

### Create Payment
```http
POST /payment/create-bill
Authorization: Bearer {token}

{
    "amount": 1000,
    "description": "Order payment",
    "mobile": "+60123456789",
    "metadata": { "orderId": "123" }
}
```

### Get Payment Status
```http
GET /payment/status/:bill_id
Authorization: Bearer {token}
```

### Get Payment History
```http
GET /payment/history?page=1&per_page=20&status=paid
Authorization: Bearer {token}
```

### Cancel Payment
```http
DELETE /payment/cancel/:bill_id
Authorization: Bearer {token}
```

---

## Webhook Testing (Local Development)

For webhook callbacks to work locally:

1. **Install ngrok**
   ```bash
   brew install ngrok  # macOS
   ```

2. **Start ngrok**
   ```bash
   ngrok http 5002
   ```

3. **Update API_BASE_URL**
   ```env
   API_BASE_URL=https://your-ngrok-url.ngrok.io
   ```

4. **Restart backend** and test payments

---

## Environment Switching

### Development (Sandbox)
```env
BILLPLZ_ENV=sandbox
```

### Production
```env
BILLPLZ_ENV=production
BILLPLZ_PRODUCTION_API_KEY=your_production_key
BILLPLZ_PRODUCTION_COLLECTION_ID=your_production_collection
BILLPLZ_PRODUCTION_X_SIGNATURE=your_production_signature
API_BASE_URL=https://your-production-api.com
```

---

## Next Steps

1. ✅ Complete sandbox setup
2. ✅ Test payment creation
3. ✅ Test webhook callbacks
4. 📱 Create payment history screen
5. 🔔 Add payment notifications
6. 💼 Implement business logic in webhook
7. 🚀 Move to production

---

## Need Help?

- Full documentation: `BILLPLZ_SETUP.md`
- Billplz API docs: https://www.billplz.com/api
- Billplz sandbox: https://www.billplz-sandbox.com

## Payment Flow

```
1. User clicks "Pay"
2. App calls /payment/create-bill
3. Backend creates bill in Billplz
4. User redirects to Billplz payment page
5. User completes payment (FPX/Card)
6. Billplz sends webhook to backend
7. Backend updates payment status
8. User redirects back to app
```

---

## Example: Add to Profile Screen

```tsx
import { PaymentModal } from '@/components/modals/user/PaymentModal';

export default function ProfileScreen() {
    const [showPayment, setShowPayment] = useState(false);

    return (
        <View>
            <Button
                title="Top Up RM 50"
                onPress={() => setShowPayment(true)}
            />

            <PaymentModal
                visible={showPayment}
                onClose={() => setShowPayment(false)}
                defaultAmount={50.00}
                description="Account Top Up"
                onSuccess={(payment) => {
                    Alert.alert('Success', 'Payment created! Complete the payment in your browser.');
                }}
            />
        </View>
    );
}
```
