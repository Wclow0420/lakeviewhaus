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
