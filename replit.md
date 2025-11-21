# FaidaFleet - Fleet Management System

## Overview

FaidaFleet is a comprehensive web-based fleet management system designed for matatu (public transport vehicles) and logistics operators in Kenya. The application provides digital tracking of vehicles, drivers, daily collections (cash & M-Pesa), expenses, and profitability analytics with a multi-tenant architecture supporting multiple fleet owners.

The system is built as a full-stack web application using Next.js 15 with React 18, leveraging Supabase for backend services including PostgreSQL database, authentication, and Row Level Security (RLS) for data isolation. The application features both fleet owner and admin portals, AI-powered M-Pesa reconciliation, and comprehensive financial analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 15 (App Router) with React 18 and TypeScript
- Server-side rendering (SSR) with React Server Components
- Client-side components marked with 'use client' directive
- File-based routing under `/src/app` directory
- Separate layout structures for main app (`/app/(app)`) and admin portal (`/app/admin`)

**UI Component System**: 
- Tailwind CSS for styling with custom theme configuration
- shadcn/ui component library (Radix UI primitives)
- Custom design tokens for colors, spacing, and typography
- PT Sans font family for consistent typography
- Responsive design with mobile-first approach

**State Management**:
- React hooks for local component state
- Supabase client for real-time data subscriptions
- Server Actions for form submissions and mutations

**AI Integration**:
- Google Genkit AI framework for M-Pesa transaction reconciliation
- Firebase integration for AI model deployment
- Dedicated AI flows in `/src/ai/flows` directory

### Backend Architecture

**Backend-as-a-Service**: Supabase
- PostgreSQL database with full SQL capability
- Built-in authentication service
- Row Level Security (RLS) policies for multi-tenant data isolation
- Real-time subscriptions support
- Server-side API routes via Next.js App Router

**Multi-Tenant Design**:
- Tenant-based data isolation using `tenant_id` foreign keys
- Membership table linking users to tenants with role-based access
- Helper functions (`current_tenant_ids()`, `has_tenant_role()`) for permission checks
- Four user roles: Owner, Admin, Accountant, Driver

**Database Schema** (10 core tables):
1. `tenants` - Fleet companies/organizations
2. `profiles` - User profiles extending Supabase auth.users
3. `memberships` - User-tenant relationships with roles
4. `drivers` - Driver records
5. `vehicles` - Vehicle/matatu tracking with compliance dates
6. `driver_assignments` - Historical driver-vehicle assignments
7. `collections` - Daily revenue tracking (cash and M-Pesa)
8. `mpesa_transactions` - M-Pesa webhook data for reconciliation
9. `expenses` - Expense tracking by category
10. `maintenance_logs` - Vehicle maintenance history

**Performance Optimizations**:
- Database indexes on foreign keys and frequently queried fields
- Materialized view (`kpi_daily`) for dashboard metrics aggregation
- Automatic timestamp triggers for audit trails
- Auto-profile creation trigger on user signup

### Authentication & Authorization

**Authentication Provider**: Supabase Auth
- Email/password authentication
- Google OAuth integration
- Password reset flow with email verification
- Session management with secure cookies
- Middleware-based route protection (`/src/middleware.ts`)

**Authorization Strategy**:
- Row Level Security (RLS) policies on all tables
- Role-based access control (RBAC) through memberships table
- Server-side permission checks using Supabase client
- Client-side guards for UI component visibility

**Protected Routes**:
- All routes except `/login`, `/signup`, `/reset-password` require authentication
- Admin routes (`/admin/*`) require special admin role verification
- Tenant-specific data filtering enforced at database level

### Data Flow Patterns

**Authentication Flow**:
1. User signs up → Supabase creates auth.users record
2. Database trigger creates profile record automatically
3. User completes onboarding → Creates tenant and owner membership
4. User logs in → Session stored in secure HTTP-only cookies
5. Middleware validates session on each request

**Data Access Pattern**:
1. Client requests data via Supabase client
2. RLS policies automatically filter by user's tenant(s)
3. Helper functions verify role permissions
4. Data returned only if user has access

**M-Pesa Reconciliation Flow**:
1. M-Pesa webhook posts transaction data
2. Data stored in `mpesa_transactions` table
3. AI flow analyzes transaction (amount, MSISDN, vehicle code, timestamp)
4. System matches against `collections` records
5. Successful match updates reconciliation status

## External Dependencies

### Core Services

**Supabase** (Primary Backend)
- PostgreSQL database hosting
- Authentication and user management
- Real-time data subscriptions
- Row Level Security enforcement
- Project ID: fohshifanqdhzbzhddkq
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Vercel** (Hosting/Deployment)
- Next.js application hosting
- Automatic deployments from Git
- Edge functions for API routes
- CDN for static assets

**Google AI (Gemini)** (AI/ML Service)
- Genkit AI framework integration
- Gemini 2.5 Flash model for transaction reconciliation
- Natural language processing for matching logic
- Environment variable: Google AI API key required

**Safaricom Daraja API** (Payment Integration)
- M-Pesa payment gateway
- Webhook endpoints for transaction notifications
- STK Push for payment collection
- Transaction verification and reconciliation

### UI Component Libraries

**Radix UI** (Headless UI Components)
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-label
- @radix-ui/react-popover
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slider
- @radix-ui/react-switch
- @radix-ui/react-tabs
- @radix-ui/react-toast
- @radix-ui/react-tooltip

**Supporting Libraries**:
- Lucide React (Icon library)
- class-variance-authority (Component variants)
- clsx + tailwind-merge (CSS class utilities)
- date-fns (Date formatting)
- react-hook-form (Form management)
- embla-carousel-react (Carousel components)

### Development Dependencies

**TypeScript Configuration**:
- Strict type checking enabled
- Path aliases configured (`@/*` → `./src/*`)
- React JSX transform
- Next.js type definitions

**Build Configuration**:
- TypeScript build errors ignored for development speed
- Remote image patterns configured for placeholder images
- Port 5000 for development server
- Environment-specific build settings

### Image Sources

**Placeholder Images**:
- picsum.photos (Driver avatars)
- images.unsplash.com (Generic images)
- placehold.co (Fallback placeholders)

All remote image domains whitelisted in Next.js config for optimization.