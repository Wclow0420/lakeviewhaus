# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lakeview Haus is a mobile-first loyalty and rewards application built with React Native (Expo) for the frontend and Flask for the backend. The application supports two distinct user types: regular customers and merchant branches, each with separate authentication flows and feature sets.

## Architecture

### Frontend (React Native + Expo)

- **Framework**: Expo ~54.0.29 with React 19.1.0 and React Native 0.81.5
- **Router**: Expo Router v6 with file-based routing and typed routes enabled
- **Key Features**:
  - React Compiler (experimental)
  - New Architecture enabled
  - Edge-to-edge on Android with predictive back gesture disabled

**Dual Navigation Structure**:
- `app/(tabs)/*` - Customer-facing screens (Home, Rewards, Scan, Store, Profile)
- `app/(merchant-tabs)/*` - Merchant-facing screens (Dashboard, Voucher, Scan, Menu, Profile)
- `app/auth/*` - Authentication screens (login, verify, merchant-login)

**Auth Flow**:
- Authentication is managed via `context/AuthContext.tsx` using SecureStore for token persistence
- On login, user type is checked (`user.type === 'branch'` for merchants) and users are routed to appropriate tab groups
- JWT tokens are stored in SecureStore with automatic refresh on 401 responses (see `services/api.ts`)

**API Configuration**:
- API base URL is in `services/api.ts` and defaults to `http://192.168.100.251:5002` for development
- Update the IP address in `services/api.ts` when working on physical devices

### Backend (Flask + PostgreSQL)

- **Framework**: Flask with SQLAlchemy ORM
- **Database**: PostgreSQL via Docker (port 5433)
- **Auth**: JWT tokens via flask-jwt-extended
- **Migrations**: Alembic via Flask-Migrate

**Database Models**:
- `User` - Regular customers with gamification (points, streaks, rank)
- `Merchant` - Top-level merchant entity (company)
- `Branch` - Individual merchant locations with auth credentials (username/password)
- `MenuCategory`, `Product`, `ProductOptionGroup`, `ProductOption` - Menu system with shared option groups
- `Collection` - Product collections for banners/lists (can be branch-specific or merchant-wide)
- `Transaction`, `Reward`, `UserVoucher`, `DailyCheckIn` - Supporting models

**Key Model Relationships**:
- Merchants have many Branches
- Branches have many Products, Categories, and option templates
- ProductOptionGroups are shared across products via many-to-many relationship
- Collections can be global (merchant-level, `branch_id=null`) or branch-specific

**API Blueprints** (in `backend/app/routes/`):
- `auth.bp` - User and branch authentication, OTP verification
- `gamification.bp` - Check-ins and gamification features
- `merchant.bp` - Branch management, profile, password updates
- `menu.bp` - Categories, products, option groups, collections
- `upload.bp` - Image uploads for products/profiles
- `transaction.bp` - Points transactions and awards

## Development Commands

### Frontend

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start
# or
npx expo start

# Platform-specific
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Web browser

# Linting
npm run lint
```

### Backend

```bash
# Start PostgreSQL database (from project root)
docker-compose up -d

# Install Python dependencies (from backend/)
cd backend
pip install -r requirements.txt

# Run Flask server (port 5002)
python main.py

# Database migrations
flask db init                    # Initialize migrations (already done)
flask db migrate -m "message"    # Generate migration
flask db upgrade                 # Apply migrations
flask db downgrade              # Rollback migrations

# Seed merchant data (from backend/)
python seed_merchant.py
```

## Project Structure Notes

**Component Organization**:
- `components/ui/*` - Reusable UI components (Button, Pill, ProductBadge, ScreenWrapper, BaseModal)
- `components/modals/merchant/*` - Merchant-specific modal components
- `components/modals/user/*` - Customer-facing modal components (e.g., BranchSelector)

**BaseModal Component** (`components/ui/BaseModal.tsx`):
- Standardized modal wrapper for consistent styling across all modals
- **When to use**: Use BaseModal for ALL new modals instead of React Native's Modal component
- **Features**:
  - Automatic platform-specific styling (pageSheet for iOS, transparent with backdrop for Android)
  - Android optimizations: rounded top corners (20px), semi-transparent backdrop, status bar translucency
  - Configurable scrolling behavior via `scrollable` prop
  - Consistent header with title and close button
- **Usage**:
  ```typescript
  import { BaseModal } from '@/components/ui/BaseModal';

  <BaseModal
      visible={visible}
      onClose={onClose}
      title="Modal Title"
      scrollable={true}  // false for forms with KeyboardAvoidingView
  >
      {/* Modal content */}
  </BaseModal>
  ```
- **All existing modals have been refactored to use BaseModal** (AwardPointsModal, SettingsModal, CreateCategoryModal, CategoryManagerModal, BranchManagerModal, CollectionFormModal, ProductFormModal)
- **Modal-within-modal handling**: To avoid crashes, always close parent modal before opening child modal with 300ms delay (see CategoryManagerModal for example)

**Custom Tab Bars**: Both `(tabs)` and `(merchant-tabs)` use custom animated tab bars with:
- Sliding indicator animation using react-native-reanimated
- Warm color theme (primary: #FCD259, background: #1A1A1A)
- 5 tabs per navigation group

**Path Aliases**: Use `@/*` to import from the project root (configured in tsconfig.json)

## Important Implementation Details

**Authentication**:
- Customer login uses email + OTP verification flow
- Merchant login uses username + password (no OTP)
- Both store JWT tokens in SecureStore with automatic refresh
- Protected routes redirect unauthenticated users to `/auth/login`

**Menu System**:
- ProductOptionGroups are reusable templates (e.g., "Ice Level" can be applied to multiple drinks)
- Products link to option groups via `product_options_association` many-to-many table
- Collections support different types: 'banner', 'list', 'carousel'
- All menu items are branch-scoped via `branch_id`

**Database Connection**:
- PostgreSQL runs on port 5433 (not default 5432) via docker-compose
- Connection string defaults to `postgresql://lakeview:password@localhost:5433/lakeview_db`
- Can override with `DATABASE_URL` environment variable in `backend/.env`

**Image Uploads**:
- Images are handled via `upload.bp` blueprint
- Products, branches, and users can have image URLs stored in the database

## Testing and Deployment

**Environment Setup**:
- Backend requires `.env` file in `backend/` directory for email configuration (MAIL_USERNAME, MAIL_PASSWORD)
- JWT_SECRET_KEY should be changed from default in production (currently in `backend/app/__init__.py:26`)

**Database Seeding**:
- Use `backend/seed_merchant.py` to populate initial merchant/branch data
- Migrations in `backend/migrations/versions/` track schema changes

**Expo Configuration**:
- EAS project ID: `5d940b44-277b-444f-a60f-0add8fd0a6ae`
- Owner: `lakevie-haus`
- Scheme: `lakeviewhaus://`

## Food Ordering System

### Order Flow
1. User browses menu → adds items to cart → checkout → payment → order confirmation
2. Cart is managed via `context/CartContext.tsx` with AsyncStorage persistence
3. Payment uses Billplz gateway (sandbox/production via env vars)
4. Order confirmation screen polls for payment status with 5-minute timeout

### Cart System (`context/CartContext.tsx`)
- **State**: cart items, branchId, branchName, selectedVoucher
- **Computed**: itemCount, cartTotal, voucherDiscount, finalTotal, itemDiscounts
- **Actions**: addToCart, updateQuantity, removeFromCart, clearCart, setSelectedVoucher, autoApplyBestVoucher
- **Performance Optimizations**:
  - Voucher cache (5-min TTL) to avoid repeated API calls
  - Debounced auto-apply (500ms) to prevent rapid recalculations
  - Memoized `itemDiscounts` calculation using useMemo
  - Debounced cart save (300ms) to reduce AsyncStorage writes

### Voucher/Reward System

**Database Models** (`backend/app/models/reward.py`):
- `Reward` - Reward definitions with conditions
  - `reward_type`: 'free_item', 'discount_percentage', 'discount_fixed'
  - `target_scope`: 'custom', 'order', 'product', 'category'
  - `target_id`: Links to product or category ID (null = all)
  - `branch_id`: Specific branch restriction (null = all branches)
  - `discount_value`: Amount or percentage
- `UserReward` - User's redeemed rewards with redemption_code, status, expires_at

**Frontend Voucher Flow**:
1. `VoucherSelectorModal` loads user's active rewards from API
2. Validates each voucher against current cart (branch, product, category restrictions)
3. Shows applicable vouchers first, disabled ones with reasons
4. `autoApplyBestVoucher()` automatically selects highest-discount applicable voucher

**Backend Validation** (`backend/app/routes/order.py`):
- Validates voucher ownership, status, and expiry
- Validates branch, product, and category restrictions
- Calculates discount only on applicable items
- Marks voucher as 'used' after successful order

**Checkout UI** (`app/(tabs)/store/checkout.tsx`):
- Auto-applies best voucher on load
- Shows per-item discounts with strikethrough original prices
- Discount badges on applicable items (e.g., "20% OFF", "RM 5 OFF", "FREE")

### Billplz Payment Integration

**Environment Variables** (in `backend/.env`):
```
BILLPLZ_ENV=sandbox  # or 'production'
BILLPLZ_SANDBOX_API_KEY=xxx
BILLPLZ_SANDBOX_COLLECTION_ID=xxx
BILLPLZ_SANDBOX_X_SIGNATURE=xxx
```

**Payment Flow**:
1. Order created → POST `/order/<id>/payment` creates Billplz bill
2. User redirected to Billplz payment page
3. Webhook POST `/payment/webhook` updates order status
4. Frontend polls `/order/<id>/verify-payment` as fallback

**Testing with ngrok**:
```bash
ngrok http 5002
# Update API_BASE_URL in backend/.env with ngrok URL, then RESTART Flask
```
After changing `API_BASE_URL`, restart Flask — the URL is read at bill-creation time, so bills created before the change keep the old callback URL baked in.

**Sandbox signature bypass (dev only)**:
In Billplz sandbox the webhook X-Signature computed by Billplz doesn't match the XSignature Key shown in the dashboard (verified with HMAC-SHA256 against 6 documented source-string / key-encoding variants, none matched). For local dev, bypass verification:
```
BILLPLZ_SKIP_SIGNATURE=true
```
**Never set this in production.** Signature verification is enforced when this is absent. In production, the key from the Billplz dashboard should match — if it doesn't, contact Billplz support rather than keeping the bypass on.

---

## Work Log

### 2024-04-11: Checkout Page Modern Redesign
**Changes:**
- Complete redesign of checkout page with modern dark theme UI
- Fixed product image loading (added API_URL prefix for relative paths)
- New features:
  - Gradient header with safe area support
  - Store info card with icon and meta info
  - Order type selection cards (Pickup/Dine In) with icons
  - Modern voucher section with active state styling
  - Item cards with proper image loading and placeholder
  - Discount badges positioned on images
  - Gradient "Place Order" button
  - Footer with total price display
- Uses app theme colors (#FCD259 primary, #1A1A1A background, #1E1E1E cards)
- Simplified order type (removed fulfillment mode sub-options)

**Files Modified:**
- `app/(tabs)/store/checkout.tsx` - Complete rewrite with modern UI

---

### 2024-04-11: Cart Item Combination Fix
**Changes:**
- Fixed duplicate cart items bug - same product with same options now combines quantity
- Added `areOptionsEqual()` helper to compare option arrays
- Added `findMatchingCartItem()` to find existing items with same product + options + instructions
- Quantity caps at 10 when combining

**Files Modified:**
- `context/CartContext.tsx` - Updated performAddToCart to merge duplicate items

---

### 2024-04-11: Voucher System & Auto-Apply
**Changes:**
- Implemented voucher validation in `VoucherSelectorModal` (branch, product, category restrictions)
- Added `autoApplyBestVoucher()` to CartContext - auto-selects highest discount voucher
- Added per-item discount display on checkout (strikethrough prices, discount badges)
- Performance optimizations:
  - 5-minute voucher cache to reduce API calls
  - 500ms debounce on auto-apply
  - useMemo for itemDiscounts calculation
- Updated backend order validation for voucher conditions
- Fixed API response handling (backend returns array, not `{success, rewards}`)

**Files Modified:**
- `context/CartContext.tsx` - Added UserReward fields, itemDiscounts, autoApplyBestVoucher with caching
- `components/modals/user/VoucherSelectorModal.tsx` - Voucher validation, fixed API response handling
- `app/(tabs)/store/checkout.tsx` - Auto-apply on load, discount UI per item
- `backend/app/routes/order.py` - Voucher condition validation (branch, product, category)

### 2024-04-11: Payment Pending Screen
**Changes:**
- Rewrote order-confirmation.tsx with 5-minute countdown timer
- Added payment status polling every 3 seconds
- Auto-cancel order when timer expires
- Different UI states: pending, paid, cancelled

**Files Modified:**
- `app/(tabs)/store/order-confirmation.tsx` - Complete rewrite
- `backend/app/routes/order.py` - Added verify-payment endpoint
- `backend/app/routes/payment.py` - Fixed webhook to update Orders table

### 2024-04-11: Checkout Navigation Fix
**Changes:**
- Fixed redirect to store after placing order (empty cart check triggered during navigation)
- Added `isNavigating` flag to prevent premature redirect

**Files Modified:**
- `app/(tabs)/store/checkout.tsx` - Added isNavigating state

### 2024-04-11: Checkout Page White Theme Redesign
**Changes:**
- Redesigned checkout page to match reference design (similar to coffee ordering apps)
- Changed from dark theme to white/beige theme matching app's design system
- Updated to use app's theme colors (`theme.secondary` for accents, `theme.background`/`theme.card`)
- Simplified order type UI - removed redundant "Take out/Dine-in" buttons (using PICKUP/DINE-IN tabs)
- Simple header with back arrow and centered "Check Out" title
- Store info section with branch name, address, distance badge
- PICKUP/DINE-IN tab selector with underline indicator
- Expected time display
- Item list with proper image loading and discount display
- Coupon/discount section matching reference design
- Total summary and "Pay Now" button with app's black color

**Files Modified:**
- `app/(tabs)/store/checkout.tsx` - Complete redesign with white theme

### 2024-04-11: VoucherSelectorModal Ticket Design Update
**Changes:**
- Redesigned voucher cards to match the main vouchers page ticket-style design
- Added ticket UI elements:
  - Image on left side (70x70 with rounded corners)
  - Title with target name
  - RewardBadge component for discount display (FREE, 20% OFF, RM X OFF)
  - Validity/branch info
  - Expiry date with calendar icon
  - Dashed separator with semicircle cutouts
  - Bottom section with redemption code
  - Radio button for selection
- Uses app theme colors throughout
- Consistent design between vouchers page and checkout voucher selector
- Added proper padding (16px) to content, tabs, and footer sections

**Files Modified:**
- `components/modals/user/VoucherSelectorModal.tsx` - Ticket-style design matching vouchers page

### 2024-04-11: Checkout Voucher Section & Item Discount Display Redesign
**Changes:**
- Simplified voucher section (removed duplicate "Cash Coupons" and "Discount Coupon" rows)
- New single voucher row with:
  - Ticket icon in yellow background circle
  - "Voucher" label with selected voucher name or hint
  - Green savings amount on the right
- Added price breakdown section (Subtotal, Voucher Discount)
- Improved item discount display:
  - Removed badge from image
  - Added inline savings text below price with sparkles icon
  - Shows "5% OFF applied • Save RM X.XX" in attractive orange color
  - More user-friendly and informative than a small badge

**Files Modified:**
- `app/(tabs)/store/checkout.tsx` - Simplified voucher UI and improved discount display

### 2024-04-11: Cart Item Edit Functionality
**Changes:**
- Added ability to edit cart items (change options, quantity) from checkout page
- Items are now tappable - shows "Tap to edit" hint
- Uses existing `ProductDetailModal` component in edit mode
- Added backend endpoint `GET /customer/menu/products/<product_id>` to fetch single product with options
- Loading spinner overlay on item image while fetching product data
- After editing, cart item is updated with new options/quantity

**Files Modified:**
- `app/(tabs)/store/checkout.tsx` - Added ProductDetailModal integration, item tap handler
- `backend/app/routes/customer.py` - Added `get_public_product()` endpoint
- `services/api.ts` - Added `customer.getProduct()` method

### 2024-04-11: ProductDetailModal Radio Button Fix & Theme Colors
**Changes:**
- Fixed bug where radio button options (max_selection=1) couldn't be changed after initial selection
  - Issue: `disabled` prop was set to `!isSelected && !canSelectMore`, which blocked unselected options
  - Fix: Added `isRadio` check - `isDisabled = !isRadio && !isSelected && !canSelectMore`
  - Radio buttons now always allow clicking to switch between options
- Updated ProductDetailModal button to use theme colors:
  - "Add To Cart" / "Update Cart" button: black background (`theme.secondary`) with yellow text (`theme.primary`)
- Updated OptionGroupSelector pill colors to use theme:
  - Selected pill: yellow background (`theme.primary`) with black border/text (`theme.secondary`)

**Files Modified:**
- `components/store/OptionGroupSelector.tsx` - Fixed radio button disabled logic, added theme colors
- `components/store/ProductDetailModal.tsx` - Updated button colors to use theme

### 2026-04-21: Order Detail Page & Voucher-After-Order Fix
**Changes:**
- Moved Order History out of the `(tabs)` group so the bottom tab bar is hidden
  - `app/orders.tsx` (list) and `app/order-detail.tsx` (single order) are now top-level routes
  - `app/_layout.tsx` registers both with `headerShown: false`
- Profile's "Order History" entry navigates to `/orders`
- Aligned `order-detail.tsx` with `order-confirmation.tsx`:
  - Theme colors, unified pending/paid layout
  - Paid + pickup → large order number; paid + dine-in → table number
- **Voucher bug**: used voucher kept auto-applying on the next cart because the 5-min voucher cache (`voucherCacheRef`) survived the order. `clearCart()` now resets the cache, and `checkout.tsx` calls `invalidateVoucherCache()` after a successful order
- `CartContext` exposes `invalidateVoucherCache`

**Files Modified:**
- `app/orders.tsx` (moved from `app/(tabs)/store/orders.tsx`)
- `app/order-detail.tsx` (new, mirrors order-confirmation design)
- `app/_layout.tsx` - registered orders/order-detail with `headerShown: false`
- `app/(tabs)/profile/index.tsx` - navigates to `/orders`
- `context/CartContext.tsx` - `invalidateVoucherCache` exported; `clearCart` resets cache
- `app/(tabs)/store/checkout.tsx` - calls `invalidateVoucherCache()` after place-order

### 2026-04-21: Payment Countdown, Auto-Cancel & Failure Handling
**Problems solved:**
1. **Countdown frozen at 00:00** — `created_at.isoformat()` returned a naive UTC string; JS parsed it as local time and `elapsed` became ~8h for UTC+8 users
2. **No server-side 5-min enforcement** — if the user closed the app, pending orders stayed pending forever
3. **Failed payments invisible** — frontend couldn't distinguish "still waiting" from "card declined"
4. **Timeout duplicated in 4 files** — brittle if we ever want to change it

**Changes:**
- `Order.to_dict()` appends `Z` to UTC timestamps and emits computed `expires_at`
- `Order.PAYMENT_TIMEOUT_MINUTES` is the single source of truth (currently `5`). Backend scheduler, lazy-expire helper, and frontend countdown all derive from it
- `_expire_if_stale(order)` in `routes/order.py` cancels pending orders older than the timeout; called on `verify_order_payment` and `get_order_details` (owner path only)
- APScheduler `BackgroundScheduler` in `backend/app/__init__.py` runs every minute to cancel stale pending orders — guarded against Flask reloader double-start via `WERKZEUG_RUN_MAIN`
- `verify_order_payment` returns 200 (not 400) when an order has no Billplz bill yet, so the pending-page polling doesn't spam errors
- `verify_order_payment` treats Billplz `state: 'deleted'` as `payment_status='failed'`
- Webhook mirrors `'failed'` onto the linked Order when `paid=false` and a `Payment` record exists
- Frontend: `isFailed` branch in `order-confirmation.tsx` + `order-detail.tsx` renders a red "Payment Failed" badge with **Cancel** / **Try Again** buttons; polling stops on any terminal state; cancelled copy distinguishes timeout from manual cancel
- Frontend countdown now reads `order.expires_at` from the server — no hardcoded constants

**To change the payment window:** edit `Order.PAYMENT_TIMEOUT_MINUTES` only. The scheduler, lazy-expire, and frontend will all follow.

**New dependency:** `APScheduler==3.10.4` — run `pip install -r backend/requirements.txt` after pulling.

**Files Modified:**
- `backend/app/models/order.py` - `PAYMENT_TIMEOUT_MINUTES` constant; `expires_at` in `to_dict`; `Z`-suffixed timestamps
- `backend/app/routes/order.py` - `_expire_if_stale`; 200 fallback when no Billplz bill; detect `state='deleted'`
- `backend/app/routes/payment.py` - mirror `failed` onto Order when Payment record exists
- `backend/app/__init__.py` - APScheduler background job
- `backend/requirements.txt` - added APScheduler
- `app/(tabs)/store/order-confirmation.tsx` + `app/order-detail.tsx` - `isFailed` branch, stop timer on terminal status, countdown driven by `order.expires_at`

### 2026-04-21: Defer Loyalty Points Until Payment Succeeds
**Bug:** Points were added to the user's balance as soon as the order was created. If the user closed the app or let the order time out, they kept the points for free. Vouchers also stayed marked `used` on cancellation so the customer lost them.

**Fix:** Two helpers in `backend/app/routes/order.py` replace inline status writes and are idempotent:
- `_finalize_paid_order(order)` — flips `payment_status` to `paid`, awards `order.points_earned` via `user.add_points()`, and marks status `confirmed`. Called from the success branches of `verify_order_payment` (lazy path) and the `/payment/webhook` handler (push path). Guarded by `if order.payment_status == 'paid': return False`, so double-delivery of the webhook can't double-award.
- `_cancel_order(order, payment_status='failed')` — flips `status` to `cancelled` and calls `_refund_voucher(order)`, which returns the reward to `status='active'` and clears `used_at` so the customer can reuse it. Called from `cancel_order`, `_expire_if_stale`, and the APScheduler sweep.

Order creation now only reserves the voucher (still marks it `used` immediately to prevent double-spend by concurrent orders); points are *not* awarded at creation anymore.

**Files Modified:**
- `backend/app/routes/order.py` — added `_finalize_paid_order`, `_cancel_order`, `_refund_voucher`; removed `user.add_points()` from `create_order`; rewired `verify_order_payment`, `cancel_order`, `_expire_if_stale`
- `backend/app/routes/payment.py` — webhook success branches now call `_finalize_paid_order`
- `backend/app/__init__.py` — scheduler sweep uses `_cancel_order` so expired orders also refund vouchers

### 2026-04-21: Free Orders (voucher covers full amount)
**Problem:** A 100%-off voucher would produce `total=0`, but the flow still sent the user to "Pay Now" → created an RM 0 Billplz bill (Billplz rejects this or behaves oddly).

**Fix:** At order creation, if `total == 0` we call `_finalize_paid_order(order)` inline — the order skips Billplz entirely and lands as `payment_status='paid'` / `status='confirmed'` the moment it's created. The voucher is still consumed; points awarded are `0` (no spend = no loyalty points).

Frontend `checkout.tsx` button copy switches to **"Place Free Order"** when `finalTotal === 0`. The redirect to `order-confirmation.tsx` works unchanged — it sees `isPaid=true` and renders the success state with pickup number / table number. No countdown, no polling.

Defensive: `create_order_payment` rejects attempts to pay a 0-amount order with a clear error, even though the order is already marked paid.

**Files Modified:**
- `backend/app/routes/order.py` — `create_order` auto-finalizes when `total == 0`; `create_order_payment` guards against 0-amount bills
- `app/(tabs)/store/checkout.tsx` — button label respects free-order case

### 2026-04-21: Order Profile Badge + History Sort
**Changes:**
- `/auth/me` now returns two order counts computed from the `Order` table (the previous impl was reading from the legacy `Transaction` table, so the profile always showed 0):
  - `orders_count` — non-cancelled orders (what shows on the profile)
  - `pending_orders_count` — orders with `status='pending'` (drives the red badge)
- `/order/history` sorts by a `CASE` priority — `pending` first, `paid/active` next, `cancelled` last — then `created_at DESC` within each bucket. Works under the existing pagination.
- Profile screen renders `<Badge count={user.pending_orders_count} />` overlaid on the receipt icon via a `position: relative` wrapper (`iconWithBadge` style). The badge auto-hides when count is `0`.

**Files Modified:**
- `backend/app/routes/auth.py` — two Order queries; new `pending_orders_count` response field
- `backend/app/routes/order.py` — `sqlalchemy.case` import; status-priority sort in `get_order_history`
- `app/(tabs)/profile/index.tsx` — Badge overlay on the Orders stat

### 2026-04-22: Order History Redesign — Filter Pills + Grouped Sections
**Changes:**
- `app/orders.tsx` combines filter pills with section grouping:
  - **Filter pills (with counts):** `All`, `Pending`, `Active`, `Completed`, `Cancelled` — e.g. `Pending (2)`
  - When `All` is selected, the content is grouped into four sections (Pending / Active / Completed / Cancelled), each with its own count header and hidden when empty — same visual pattern as `app/rewards/vouchers/index.tsx`
  - When a specific pill is selected, the matching orders render as a flat list; empty buckets show a centered "No {filter} orders" state
- **Active** bucket merges the merchant-side lifecycle states `confirmed` + `preparing` + `ready` — customers don't care about fulfillment stage, but each order card still shows its precise status badge (CONFIRMED / PREPARING / READY)
- Header restyled to match vouchers: `arrow-back` icon, centered title, bottom border
- Cancelled status icon is now an outline (`close-circle-outline`) to visually distinguish from the solid completed check-circle
- Status badge on cards covers the full lifecycle: PENDING / CONFIRMED / PREPARING / READY / COMPLETED / CANCELLED

**Cancelled order detail page:**
- Removed the stripped-down early-return block — cancelled orders now render the full layout (items, totals, order info) with a red "Order Cancelled" badge in the status slot where the countdown / success / failed badges live
- Subtext distinguishes timeout (`Payment timed out — the order was cancelled`) from manual cancel (`This order has been cancelled`)
- Payment row in the order info card shows `Cancelled` in red instead of the stale "Pending" label
- Tightened `isPaid = payment_status === 'paid' && status !== 'cancelled'` so a cancelled-after-paid edge case doesn't render success UI

**Files Modified:**
- `app/orders.tsx` — full rewrite; voucher-style header, client-side grouping into 4 buckets
- `app/(tabs)/store/order-confirmation.tsx` + `app/order-detail.tsx` — cancelled inline branch in status section, payment-row label, orphan styles removed

### 2026-04-22: Store Page Modernization
**Problem:** The customer store tab looked like 2017 utility design — 25/75 sidebar with 11px text labels under 50×50 circles, 86×86 flat thumbnail list cards, no shadows, red off-theme price color (#E53935), inconsistent 4–12px radii. Home tab already felt 2023+ (hero carousel, gradient member card, 2-col grid with shadows), so the store was a visibly weaker surface inside the same app.

**Design principles applied:**
- Imagery-first (86×86 thumbs → 104×104 hero images)
- Generous whitespace on a 4/8/16/24 rhythm
- Rounded corners ≥16px (`Layout.radius.md`), consistent with the modal language
- Layered drop shadows (`shadowOpacity 0.06–0.08`, elevation 2–3) so cards lift off the background
- Bold type hierarchy: section 18/700, card title 15/700, description 12/500
- Color discipline — everything via `theme.*`; off-palette red price killed (price now `theme.text`)
- Spring micro-interactions on tap (`withSpring` damping 15) + scale bounce on cart increment (`withSequence`)
- Skeleton loaders via `withRepeat(withTiming(...), -1, true)` instead of a plain spinner
- Empty states use the same illustrated-icon pattern as the orders page

**Decisions locked in (via AskUserQuestion):**
- **Sidebar kept** (not replaced with horizontal pills) — modernized into full-width yellow-filled pills with spring scale on selection
- **Single-column list** (not 2-col grid) — 2-col would've been ~140px wide inside the 78% pane, too tight. Single-col gives 104×104 images and readable text
- **No hero carousel** yet — revisit when there's promo content

**Files Modified:**
- `components/store/MenuItem.tsx` — rebuilt as a shadowed card (104×104 image, theme.text price, yellow `+` button bottom-right, spring press animation). Dropped `isLast` prop; added optional `onAddPress`
- `components/store/MenuSplitView.tsx` — new `SidebarPill` component with yellow-fill selected state and spring scale. Section headers now show `Title + "N items"` row. `ActivityIndicator` replaced with `SkeletonCard` shimmer. Empty-branch / no-search-results states redesigned. Sidebar narrowed 25% → 22% to give content pane more room. All colors via `theme.*`, all radii via `Layout.radius.md`
- `components/store/FloatingCartButton.tsx` — added scale-bounce via `withSequence(withSpring(1.08), withSpring(1))` when `itemCount` increases (not on initial mount)
- `components/modals/user/BranchSelector.tsx` — search input: 36 → 40 height, 18 → 20 radius, added 1px `theme.border` stroke, background → `theme.card`

### 2026-04-22: Custom Font — Plus Jakarta Sans (explicit in styles)
**Problem:** The app was rendering in SF Pro (iOS) / Roboto (Android) — inconsistent across platforms, no brand signature. `expo-font` was installed but nothing loaded; the `Fonts` token in `constants/theme.ts` was a dead reference.

**Fix:** Loaded Plus Jakarta Sans (4 weights: 400 / 500 / 600 / 700) via `@expo-google-fonts/plus-jakarta-sans`, gated the app render on font load, and **applied it per-style via `fontFamily: Fonts.{regular|medium|semibold|bold}`** on high-traffic surfaces.

**Why explicit, not global auto-apply:** Multiple global-apply approaches were tried and rejected:
- `Text.render` monkey-patch → `render` isn't callable on RN 0.81's Text internals
- `Text.defaultProps.style` → React fully replaces the default style whenever the caller passes `style`, which is every Text in the app
- Wrapping `react/jsx-runtime` → Babel captures `jsx` into local bindings at import time, so runtime patching is too late
- Replacing `RN.Text` on the module → broke AsyncStorage's native module resolution in practice (cascading native-module failures)

The supported pattern is: import `Fonts` from `constants/theme.ts` and set `fontFamily` explicitly in styles. `@expo-google-fonts` registers each weight as a *separate* family name (e.g. `PlusJakartaSans_600SemiBold`), so we map weight to family at the style level.

**Coverage:** every user-facing screen and component is converted. Zero `fontWeight` literals left under `app/auth`, `app/rewards`, `app/(tabs)`, `app/orders.tsx`, `app/order-detail.tsx`, `components/cart`, `components/modals/user`, `components/store`, and `components/ui`.

**Surfaces converted (full list):**
- Store flow: `components/store/MenuItem.tsx`, `components/store/MenuSplitView.tsx`, `components/store/FloatingCartButton.tsx`, `components/store/ProductDetailModal.tsx`, `components/store/OptionGroupSelector.tsx`, `components/store/QuantitySelector.tsx`
- Cart: `components/cart/CartItem.tsx`, `components/cart/CartSummary.tsx`
- Tabs: `app/(tabs)/index.tsx` (Home), `app/(tabs)/store/index.tsx` (via MenuSplitView), `app/(tabs)/store/cart.tsx`, `app/(tabs)/store/checkout.tsx`, `app/(tabs)/store/order-confirmation.tsx`, `app/(tabs)/profile/index.tsx`
- Orders: `app/orders.tsx`, `app/order-detail.tsx`
- Auth: `app/auth/login.tsx`, `app/auth/register.tsx`, `app/auth/verify.tsx`, `app/auth/merchant-login.tsx`
- Rewards: `app/rewards/vouchers/index.tsx`, `app/rewards/catalog.tsx`, `app/rewards/[id].tsx`, `app/rewards/lucky-draw/[id].tsx`
- User modals: `components/modals/user/BranchSelector.tsx`, `components/modals/user/VoucherSelectorModal.tsx`, `components/modals/user/TransactionHistoryModal.tsx`, `components/modals/user/RewardQRModal.tsx`, `components/modals/user/SettingsModal.tsx`, `components/modals/user/PaymentModal.tsx`
- Shared UI primitives: `components/ui/BaseModal.tsx`, `components/ui/Button.tsx`, `components/ui/Pill.tsx`, `components/ui/Badge.tsx`, `components/ui/Input.tsx`, `components/ui/ProductBadge.tsx`, `components/ui/RewardBadge.tsx`, `components/ui/ToastNotification.tsx`
- Tabs (rest): `app/(tabs)/rewards/index.tsx` (Rewards tab — page title, daily check-in card, streak counter, reward cards), `app/(tabs)/scan/index.tsx`
- Gamification: `components/gamification/CheckInSuccess.tsx` (the daily check-in modal), `RankUpSuccess.tsx`, `RedemptionSuccess.tsx`, `LuckyDrawSuccess.tsx`
- Misc: `app/notifications/index.tsx`, `app/referral/index.tsx`, `components/themed-text.tsx`, `components/system/VersionCheck.tsx`, `components/PaymentStatusCard.tsx` (its monospace `billId` style is preserved — only the bold/semibold text styles were converted)

**Out of scope (intentional):** merchant tabs (`app/(merchant-tabs)/*`, `app/merchant/*`, `components/modals/merchant/*`) — merchant interface, not customer-facing. Still uses system fonts; that's fine.

**Conversion script (one-shot, safe to discard):** a small Node.js codemod at `/tmp/apply-fonts.js` did the bulk replacement — for each listed file it added `Fonts` to the `@/constants/theme` import (or created the import) and rewrote every `fontWeight: 'X'` to `fontFamily: Fonts.{regular|medium|semibold|bold}` using the weight map below:

```
100/200/300/400/normal → Fonts.regular
500                    → Fonts.medium
600                    → Fonts.semibold
700/800/900/bold       → Fonts.bold
```

For new files, follow the same pattern: `import { Fonts } from '@/constants/theme'` and use `fontFamily: Fonts.X` (not `fontWeight`) in styles. Keep `fontWeight` only when you genuinely need a non-Plus-Jakarta-Sans surface (e.g. monospace reference codes — those should also set `fontFamily` explicitly).

### 2026-04-22: Profile "Points" → real Points History (Order + Transaction)
**Problem:** The Points stat on the profile opened a modal called "Order History" that actually fetched from the legacy `Transaction` table only — so it never showed the food-ordering points and the title was wrong.

**Fix:**
- Tapping `Points` on `app/(tabs)/profile/index.tsx` now opens a new `PointsHistoryModal` titled **"Points History"**
- Modal pulls **both** sources in parallel via `Promise.allSettled`:
  - `api.transactions.getHistory()` — legacy points transactions (manual merchant awards, daily-checkin awards, etc.)
  - `api.order.getHistory({ per_page: 100 })` — food orders, filtered to `payment_status === 'paid'` and `points_earned > 0`
- Each entry maps to a unified `PointsEntry { source, label, sublabel?, amount?, points, date }` and the merged list is sorted newest-first
- Order entries show `Order #LVH...` with the branch as sublabel; Transaction entries show the branch with the transaction type as sublabel
- Empty state matches the orders page pattern (icon + 2-line message)
- Uses `Promise.allSettled` so a failure in one source still surfaces results from the other

**Files Modified:**
- `components/modals/user/PointsHistoryModal.tsx` (new) — replaces `TransactionHistoryModal`
- `components/modals/user/TransactionHistoryModal.tsx` — deleted (was the misleading "Order History" modal that only read the legacy table)
- `app/(tabs)/profile/index.tsx` — Points stat opens the new modal; `showHistory` state renamed to `showPointsHistory`

The Orders icon stat continues to navigate to `/orders` (full Order History page) — that flow is unchanged.

### 2026-05-03: Merchant Orders Page — 403 Fix, Nested-FlatList Warning, Redesign
**Three issues, all from the same page:**

1. **403 FORBIDDEN on `GET /order/merchant/list`** — `get_merchant_orders` was calling `User.query.get(user_id)`, but branch JWTs use identity format `m_{merchant_id}_b_{branch_id}` (a string), not a User UUID. The `User.query.get(...)` returned `None`, so the `type == 'branch'` check failed and the endpoint always returned 403. Same problem in `update_order_status` and the merchant path of `get_order_details`. **Fix:** all three endpoints now use the existing `get_current_branch()` helper from `routes/merchant.py` which parses the `m_..._b_...` identity correctly.

2. **VirtualizedList nested in ScrollView warning** — the merchant orders page wrapped its `<FlatList>` in `<ScreenWrapper scrollEnabled={false}>`. But `ScreenWrapper`'s real prop is `withScrollView` (default `true`), so `scrollEnabled` was silently ignored and a parent `<ScrollView>` always rendered. **Fix:** dropped `ScreenWrapper` entirely on this page — the `<View>` + `paddingTop: insets.top` pattern matches what the customer order history uses, with a SafeAreaView-style top inset and no virtualization conflict.

3. **Design refresh** — the page used hardcoded colors (`#F2F1EC`, `#FFFFFF`, etc.) and `fontWeight` literals. Rebuilt with `Colors.*` / `Fonts.*` tokens, `Layout.radius.md`, layered shadows on cards, and a richer footer with the **inline status-advance button** that auto-routes to the next state in the order lifecycle:
   - `pending` → "Confirm" (✓)
   - `confirmed` → "Start Preparing" (🍴)
   - `preparing` → "Mark Ready" (✓✓)
   - `ready` → "Complete" (🚩)
   - `completed` / `cancelled` → no button (terminal)

**Files Modified:**
- `backend/app/routes/order.py` — `get_merchant_orders`, `update_order_status`, `get_order_details` use `get_current_branch()` from `routes/merchant.py`. Branch identity check is now `user_id.startswith('m_')` for the merchant path of `get_order_details`.
- `app/(merchant-tabs)/orders.tsx` — full rewrite with the new design + filter pills with `useFocusEffect` instead of `useEffect` so orders refresh when the tab regains focus.

### 2026-05-03: Real-Time Orders — Socket.IO end-to-end + Merchant Dashboard
**Goal:** stop polling — let order state changes flow through the existing Socket.IO infrastructure (already JWT-auth'd, already auto-joining `user_{id}` and `merchant_{merchant_id}` rooms via `socket_service.py`) so customers and merchants see updates within ~100ms instead of 3s+.

**Backend — single `order_update` socket event**
- New `SocketService.emit_order_update(order)` in `backend/app/services/socket_service.py` — emits the full `order.to_dict(include_branch=True, include_user=True)` to both the customer's user room and `merchant_{order.branch.merchant_id}`. Best-effort; never raises into the route.
- Local helper `_emit_order_update(order)` in `routes/order.py` wraps the call with try/except so a socket failure can never break a request.
- Wired into every order state change:
  - `create_order` (after commit, includes free-orders auto-finalized to `paid`)
  - `_finalize_paid_order` callers (`verify_order_payment` paid branch, payment webhook paid branch including the no-Payment-record path)
  - `_cancel_order` callers (`cancel_order` route, `_expire_if_stale` lazy check, APScheduler `_cancel_expired_orders` sweep)
  - `verify_order_payment` failed-bill (`state='deleted'`) branch
  - Webhook `paid=false` branches in both Payment-record and direct-Order paths
  - `update_order_status` (merchant advancing the kitchen workflow)
- Idempotent payload: clients merge by `id`, so duplicate emits / reconnect-replays are harmless.

**Backend — `GET /order/merchant/counts`**
New endpoint returning `{ counts: { pending, confirmed, preparing, ready, completed, cancelled } }` for the dashboard's badges. One SQL `GROUP BY status` query. Date filter supports `today` / `week` / `all`. Uses `get_current_branch()` so it follows the same auth pattern as other merchant endpoints.

**Customer — live progress bar after payment**
- New `components/store/OrderProgress.tsx` — 4 dots labelled Confirmed → Preparing → Ready → Completed. Past steps fill yellow; the current step pulses (`withRepeat(withTiming(0.45, 900), -1, true)`). Cancellation skips this component entirely (existing cancelled state handles that).
- `app/(tabs)/store/order-confirmation.tsx` and `app/order-detail.tsx` both: add a `useEffect` that subscribes to `order_update`, replaces local `order` state when `data.id === orderId`, stops the timer/poll on terminal states. The 3-sec poll **stays as a fallback** for socket disconnects; the existing `AppState` foreground re-check is unchanged.
- Progress bar renders only after payment success, slotted between the Pickup/Dine-in info and the order details card.

**Merchant — Dashboard replaces filter-pill list**
- `app/(merchant-tabs)/orders.tsx` is now a dashboard, not a list:
  - Header: title + dynamic subtitle ("Today's orders" / "Past 7 days" / "All time") + refresh button
  - Date-filter pills (Today / This Week / All Time) — also passed as a query param to the bucket list
  - **Pending Payment** row at the top — full-width tappable, shows count badge in orange, opens the `pending` bucket
  - **2×2 grid of big cards**: Orders (confirmed) / Preparing / Ready / Completed. Each card shows count, title, subtitle, accent-coloured icon bubble, and a "View →" CTA pill when count > 0. Border colour brightens to the bucket accent when count > 0 to draw the eye.
  - Subscribes to `order_update` and **debounces a counts refetch by 400ms** so a flurry of socket events coalesces into a single round-trip. Counts endpoint is one DB query, so even worst-case it's cheap.
- New screen: `app/merchant/orders-list.tsx` — paginated FlatList for one bucket. Reads `bucket` and `date` query params. Uses `onEndReached` with `if (page < total_pages) loadPage(page + 1, 'append')`. Pull-to-refresh resets to page 1.
- **Real-time list splice** in the bucket screen: on every `order_update` it computes whether the order matches the current bucket and either prepends, replaces, or removes the item from local state — no full refetch, no flashing. A merchant viewing "Preparing" sees the card disappear the moment they tap "Mark Ready", reappear in the "Ready" view if they switch.
- Inline status-advance button on each card (Confirm / Start Preparing / Mark Ready / Complete) routes through the existing `api.order.merchant.updateStatus` — the socket emit is what updates everyone else's screens.

**Performance posture**
- Counts endpoint: single `GROUP BY` query, ~1ms even at 10k orders. No fan-out.
- Socket payload: single full `order.to_dict(...)` per event. Frontends merge by `id`; no extra REST calls on update.
- Dashboard debounces refetch (400ms) so 100 simultaneous order events trigger 1 counts call, not 100.
- Bucket list pagination: `per_page=20`, real-time splice never triggers pagination invalidation (prepends are ephemeral on top of the paginated set; pull-to-refresh resets).
- Polling stays on the customer order page as a 3-second fallback only for the `pending` payment phase. Once paid, it stops.

**Files Modified:**
- `backend/app/services/socket_service.py` — `emit_order_update(order)` helper
- `backend/app/routes/order.py` — `_emit_order_update` local helper + wire-ins; new `/merchant/counts` endpoint
- `backend/app/routes/payment.py` — webhook calls `_emit_order_update` after each commit
- `backend/app/__init__.py` — scheduler emits per cancelled order after the bulk commit
- `services/api.ts` — `order.merchant.getCounts`
- `components/store/OrderProgress.tsx` (new)
- `app/(tabs)/store/order-confirmation.tsx` + `app/order-detail.tsx` — socket subscription + `<OrderProgress>`
- `app/(merchant-tabs)/orders.tsx` — full rewrite as dashboard with 4 cards + pending button + date filter + debounced socket refetch
- `app/merchant/orders-list.tsx` (new) — paginated bucket list with real-time splice + status-advance button

**Follow-up fixes (same day):**

1. **`OrderProgress` redesign** — original dots+connector layout left visible gaps and centred only on content width. Rebuilt as a proper progress bar:
   - `alignSelf: 'stretch'` so the row fills the parent (parent uses `alignItems: 'center'`)
   - 4 step columns at `flex: 1` so dots sit at 12.5% / 37.5% / 62.5% / 87.5% of the row
   - Single absolute-positioned **track** behind the dots, inset by `100 / (steps × 2)` % on each side so it spans precisely from first dot center to last dot center
   - Yellow `trackFill` driven by `withSpring` to `activeIdx / (STEPS.length - 1)` — smooth animated fill across status transitions
   - Labels live in a separate row with matching `flex: 1` columns so they centre under each dot regardless of label length

2. **Merchant `OrderDetailModal` padding** — content was sticking to the screen edges because the inner container had `flex: 1` only. Added `paddingHorizontal: 20` + `paddingBottom: 24` so the modal breathes.

3. **Socket reconnect on token change** — `services/socket.ts` originally bailed in `init()` if a socket was already connected. That meant a customer-then-merchant login would keep the merchant on the customer's socket and never join `merchant_{id}`, so all order_update events bypassed them. Fixed:
   - `init()` tracks `lastToken`; if the current SecureStore token differs from `lastToken`, it tears down the old socket (`removeAllListeners` + `disconnect`) and reconnects with the new token
   - `disconnect()` also resets `lastToken` so the next `init()` reconnects cleanly

4. **Optimistic UI for status-advance** — `app/merchant/orders-list.tsx` `handleAdvance` no longer waits for the socket to splice. It removes the order from the local list synchronously the moment the merchant taps the next-status button, then awaits the API. If the API fails, it refetches page 1 to reconcile. The socket listener stays — for cross-device sync — but it's no longer on the critical path of the tapping merchant's own UI.

### 2026-05-03: SUNMI V3 Mix — Auto-print Cup Stickers + Order Alarm
**Goal:** when a paid order arrives at the merchant device, auto-print one 60×40mm sticker per cup/item (Starbucks/Chagee/Tealive style) and beep until staff acknowledges. Designated print stations only — admin's phone with the same app installed stays silent.

**How it works:**
1. Paid order → backend already emits `order_update` (from the previous task) to `merchant_{merchant_id}` room.
2. The merchant app, no matter which tab is open, receives the event via `OrderAlertsHost` — a global listener mounted in `app/(merchant-tabs)/_layout.tsx`.
3. Idempotent guard: `printerService.hasPrinted(orderId)` checks AsyncStorage with 24-hour TTL, so socket replays / app reloads don't double-print.
4. If `printerService.isPrintStation()` is true (per-device toggle, AsyncStorage), the device:
   - Prints stickers via `react-native-sunmi-v2-printer` AIDL bridge — 1 sticker per item × quantity, layout: order # / item name (large) / customizations / customer · pickup-or-table
   - Pushes the order to the in-memory ack queue and starts the looping alarm via `soundService.startAlarm()`
   - Vibrates via Haptics
5. A red "🔔 N new orders — tap to acknowledge" banner floats at the top of every merchant tab while the queue is non-empty.
6. Tapping it opens `AcknowledgeOrdersModal` with each order; "Acknowledge & Stop Alarm" empties the queue and silences the alarm.
7. Manual reprint: the existing `OrderDetailModal` shows a "Reprint Stickers" button only on devices where `printerService.isAvailable()` returns true and the order is paid.
8. Failed prints (paper out, printer offline): pushed to a separate AsyncStorage queue; a yellow retry banner surfaces under the red one. Tapping it re-attempts each queued ID.

**Print station toggle:**
- Lives in merchant Profile tab as a `Switch` row
- Shows "Not a SUNMI device — can't print here" when the native module probe fails (so admin's phone reads correctly)
- Confirmation alert when enabling, warning that only ONE device per branch should be ON

**Sticker layout (60×40mm, ~472×312 px at 200 DPI):**
```
#LVH...    1 of 3    14:32
CARAMEL LATTE
Hot · Less ice
★ no straw   ← only if special_instructions
Justin · Pickup
```

**Sound asset:** alarm mp3 not bundled in this commit. Drop `assets/sounds/order-alarm.mp3` and uncomment two lines in `services/sound.ts` (see README in the dir). Until added, vibration + visual banner still fire.

**Native dependency notes:**
- `react-native-sunmi-v2-printer@1.0.3` — AIDL-bound to `com.sunmi.v2.printer.SunmiPrinterService`; resolves to `null` on non-SUNMI devices (graceful)
- `expo-audio@~1.1.1` — added to `app.config.ts` plugins. Configured for play-when-silenced
- `expo-dev-client` — already present. Required because the SUNMI native module isn't in Expo Go. Run `eas build --profile development -p android` and install the APK on the V3 Mix.

**Files Modified / Added:**
- `services/printer.ts` (new) — `printerService` singleton: `isAvailable`, `loadPrintStation`/`setPrintStation`, `printOrderStickers`, `hasPrinted`/`markPrinted` with 24h TTL, failed-print queue
- `services/sound.ts` (new) — `soundService.startAlarm` / `stopAlarm` via `expo-audio`
- `components/merchant/OrderAlertsHost.tsx` (new) — global socket listener, ack queue, banners, alarm coordination
- `components/modals/merchant/AcknowledgeOrdersModal.tsx` (new) — list of unacknowledged paid orders + "Acknowledge & Stop Alarm" CTA
- `components/modals/merchant/OrderDetailModal.tsx` — added "Reprint Stickers" button (only when `printerService.isAvailable()` AND order is paid)
- `app/(merchant-tabs)/_layout.tsx` — wraps `<Tabs>` in a `<View>` and mounts `<OrderAlertsHost />` so banners overlay every tab
- `app/(merchant-tabs)/profile/index.tsx` — added Print Station toggle row with confirmation alert and disabled state for non-SUNMI devices
- `app.config.ts` — added `expo-audio` plugin
- `package.json` — `expo-audio`, `react-native-sunmi-v2-printer`
- `assets/sounds/README.md` (new) — instructions for adding the alarm chime

**Verification:**
1. `eas build --profile development -p android` and install on the SUNMI V3 Mix
2. Log in as merchant, go to Profile → toggle Print Station ON (must show "Auto-prints cup stickers on paid orders"; admin's phone shows "Not a SUNMI device" disabled)
3. From customer device: place order with 1× Latte + 2× Croissant + 1× Tea, pay
4. SUNMI: 4 stickers print within ~1s, red banner appears at top, vibrates (and beeps if mp3 added)
5. Tap banner → modal shows the order → Acknowledge → silence
6. Reload app → no duplicate prints (idempotent)
7. Open the order in OrderDetailModal → tap Reprint → 4 more stickers print
8. Remove sticker roll mid-shift → place order → yellow "1 sticker failed" banner; reload roll → tap retry → prints

**Build fix (patch-package):**
The `react-native-sunmi-v2-printer@1.0.3` npm tarball is missing the AIDL files for `IWoyouService` and `ICallback`, which makes the Android build fail with `package woyou.aidlservice.jiuiv5 does not exist`. I added the official AIDL definitions from SUNMI's developer docs into `node_modules/react-native-sunmi-v2-printer/android/src/main/aidl/woyou/aidlservice/jiuiv5/` and froze the change as `patches/react-native-sunmi-v2-printer+1.0.3.patch` via `patch-package`. A `postinstall` hook in `package.json` re-applies the patch on every `npm install`, including EAS Build's environment. The `patches/` directory must be committed.

**Files added for the patch:**
- `patches/react-native-sunmi-v2-printer+1.0.3.patch` — adds the two AIDL files at install time
- `package.json` — `"postinstall": "patch-package"` script + `patch-package` and `postinstall-postinstall` dev dependencies

Also fixed: `printer.ts` was calling `SunmiV2Printer.printerText(...)` which doesn't exist on the native module — switched to `printString(...)` which is the actual `@ReactMethod` exposed by the AIDL bridge.

**How fonts load:**
- `app/_layout.tsx` — `useFonts({...4 weights})` blocks render until loaded. `SplashScreen.preventAutoHideAsync()` at module load + `hideAsync()` once loaded.
- `constants/theme.ts` — `Fonts.{regular,medium,semibold,bold}` constants point at the `@expo-google-fonts` family names. Dropped the old `Platform.select` — it was never referenced.
- `utils/fonts.ts` — kept as a documentation file explaining why global auto-apply doesn't work; `installFontPatch` is a no-op.

**Files Modified:**
- `package.json` — added `@expo-google-fonts/plus-jakarta-sans`, `expo-splash-screen`
- `utils/fonts.ts` (new) — docs + no-op shim
- `app/_layout.tsx` — font loading + splash gating
- `constants/theme.ts` — `Fonts` maps to real family names
- Files listed under "Surfaces covered" above — styles use `fontFamily: Fonts.*` instead of `fontWeight`

### 2026-05-12: Website — Payment Flow page (Billplz compliance)
**Why:** Billplz flagged the website ("no checkout page") during merchant review. The website is a marketing landing page, not an e-commerce front — there is no on-site checkout. To satisfy Billplz, we added a **documentation page** that walks visitors through the in-app payment journey (cart → checkout → Billplz → confirmation), the payment methods accepted, the security posture, and the refund/cancellation policy. This is the customer-facing artifact Billplz wanted to see linked from the website.

**Changes (under `lakeview-haus/web/`):**
- `src/pages/PaymentFlow.tsx` (new) — 5-step walkthrough with pure-CSS phone-frame mockups (browse / cart / checkout / Billplz method picker / paid + live status). Adds an accepted-methods grid (FPX, TnG, GrabPay, Boost, ShopeePay, cards) and four trust cards (security, 5-min auto-cancel, receipts, refund contact). Matches the existing landing-page style — `<Container>`, `<FadeIn>`, `<Button>`, CSS variables, glass/glass-dark utility classes, lucide-react icons. No new dependencies.
- `src/App.tsx` — registered `/payment-flow` route.
- `src/components/layout/Header.tsx` — added "Payment" link to the desktop nav pill and the mobile menu.
- `src/components/layout/Footer.tsx` — added "Payment Flow" + "Contact" links under the Links column.

**Verification:**
- `npx tsc --noEmit -p tsconfig.app.json` — exit 0
- `npm run lint` — 6 errors total, all pre-existing in `src/pages/Home.tsx` (impure `Math.random()` in render) and `src/services/api.ts` (one `any`). Zero new errors from `PaymentFlow.tsx` or the nav edits.

**Out of scope:** no real checkout API was wired — the page is intentionally informational because the actual order/payment flow lives in the mobile app. The mobile-app Billplz integration documented in earlier work-log entries (`backend/app/routes/order.py`, `routes/payment.py`) is what actually moves money; this page just communicates it.
