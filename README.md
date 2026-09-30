# FaidaFleet - Fleet Management System

FaidaFleet is a comprehensive fleet management web application designed for matatu and logistics operators in Kenya. It provides digital tracking of vehicles, drivers, daily collections (cash & M-Pesa), expenses, and profitability dashboards.

## Core Features

### Fleet Owner Features
- **Vehicles Management** - Register vehicles, track insurance/MOT expiry, compliance monitoring
- **Financial Analytics** - Revenue vs expenses dashboard, P&L statements, profit margin tracking
- **Trip & Route Tracking** - Record individual trips, calculate per-trip profitability
- **Maintenance Scheduler** - Schedule vehicle maintenance, track service history and costs
- **Driver Performance Analytics** - Earnings leaderboard, trip count, profit per driver

### Platform Features
- **Multi-Tenant Architecture** - Support multiple fleet owners with isolated data
- **Role-Based Access Control** - Owner, Admin, Accountant, and Driver roles
- **Vehicle & Driver Management** - Track fleet assets and assignments
- **Financial Tracking** - Daily collections, expenses, and profitability
- **M-Pesa Integration** - Automatic reconciliation with Daraja API
- **Real-time Dashboard** - KPIs, analytics, and performance metrics
- **Secure Authentication** - Fleet owners and drivers sign in with a phone number and PIN. System administrators sign in with email.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 18, TypeScript |
| **UI Components** | Tailwind CSS, shadcn/ui |
| **Backend & Database** | Supabase (PostgreSQL + RLS + Auth) |
| **Authentication** | Phone and PIN for fleets; email and password for system admins |
| **Payments** | Safaricom Daraja API (M-Pesa) |
| **Hosting** | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kingyepz-uopeople/FaidaFleet.git
   cd FaidaFleet
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Create a new Supabase project and put its API values in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   The service role key stays on the server. It lets a fleet owner create a driver login without replacing their own session.

4. **Set up the database**
   - Open the new project's SQL Editor
   - Run every file in `supabase/migrations/` in order, from `001_initial_schema.sql` through `007_schema_fixes.sql`
   - See `supabase/DATABASE_SETUP.md` for the same steps

5. **Turn off email confirmation for phone accounts**
   - Authentication, then Providers, then Email
   - Turn off Confirm email
   - Set the minimum password length to 4 so a 4-digit PIN is accepted
   - Fleet accounts use an internal address such as `2547XXXXXXXX@phone.faidafleet.local`. That address cannot receive mail.

6. **Create the first system administrator**
   - In Authentication, add a user with a real email and password
   - Copy that user's id
   - Run this in the SQL Editor, using that id and email:

   ```sql
   insert into public.admin_users (user_id, email, full_name, role)
   values ('paste-user-id', 'admin@example.com', 'System Admin', 'super_admin');
   ```

   System administrators sign in at `/admin-login`. Fleet owners sign up at `/signup` with a phone number and PIN. Drivers receive a phone number and PIN when a fleet owner adds them, then sign in at `/login`.

7. **Run the development server**
   ```bash
   npm run dev
   ```

8. **Open your browser**
   Navigate to `http://localhost:5000`

## Project Structure

```
FaidaFleet/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── (app)/             # Protected app routes
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── vehicles/      # Vehicle management with compliance tracking
│   │   │   ├── drivers/       # Driver management & assignments
│   │   │   ├── collections/   # Revenue tracking with reconciliation
│   │   │   ├── expenses/      # Expense tracking by category
│   │   │   ├── analytics/     # Financial analytics & P&L dashboard
│   │   │   ├── trips/         # Trip/route tracking & profitability
│   │   │   ├── maintenance/   # Maintenance scheduler
│   │   │   ├── driver-analytics/ # Driver performance leaderboard
│   │   │   └── settings/      # App settings
│   │   ├── auth/              # Auth callbacks & errors
│   │   ├── login/             # Fleet phone and PIN sign-in
│   │   ├── signup/            # Fleet owner sign-up
│   │   ├── admin-login/       # System admin email sign-in
│   │   └── reset-password/    # System admin password reset
│   ├── components/            # React components
│   │   ├── ui/                # shadcn/ui components
│   │   ├── app-header.tsx     # App header with auth
│   │   └── stat-card.tsx      # Dashboard stat cards
│   ├── lib/                   # Utilities and configs
│   │   ├── supabase/          # Supabase clients
│   │   ├── database.types.ts  # TypeScript types
│   │   └── utils.ts           # Helper functions
│   └── middleware.ts          # Auth middleware
├── supabase/
│   ├── migrations/            # Database migrations, 001 through 007
│   ├── DATABASE_SETUP.md      # Setup guide
│   ├── COMPLETE_SCHEMA.sql    # Refuses to run; use migrations
│   └── RUN_THIS_FIRST.sql     # Idempotent column check after migrations
└── docs/
    ├── blueprint.md           # Project blueprint
    ├── DATABASE_SCHEMA.md     # Schema documentation
    ├── SQL_QUICK_REFERENCE.md # SQL query examples
    ├── FEATURE_TABLES.txt     # Feature table reference
    ├── QUICK_START.md         # Short setup checklist
    ├── SUPABASE_AUTH_SETUP.md # Auth setup guide
    ├── FLEET_OWNER_SIGNUP_GUIDE.md
    └── IMPLEMENTATION_STATUS.md
```

## Multi-Tenancy & Roles

### How It Works

- Each**tenant**represents a fleet company
- Users can belong to multiple tenants
- All data is isolated per tenant using Row Level Security (RLS)
- Roles determine what actions users can perform

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Owner** | Full control - manage everything including settings and users |
| **Admin** | Manage fleet, drivers, vehicles, collections, and expenses |
| **Accountant** | Record/reconcile collections, manage expenses, view reports |
| **Driver** | Add daily collections, view own assignments |

## Database Schema

### Core Tables (10 Tables)

| Table | Purpose | Feature |
|-------|---------|---------|
| **vehicles** | Vehicle registration, type, compliance | Vehicles Management |
| **collections** | Daily revenue tracking | Financial Analytics |
| **expenses** | Daily costs by category | Financial Analytics |
| **trips** | Individual trip records | Trip Tracking |
| **maintenance_logs** | Service history | Maintenance Scheduler |
| **drivers** | Driver information | Driver Management |
| **driver_assignments** | Driver-vehicle history | Driver Management |
| **tenants** | Fleet companies | Multi-tenancy |
| **profiles** | User profiles (extends auth.users) | Authentication |
| **memberships** | User-tenant relationships | Multi-tenancy |

### Key Columns
-**vehicles**: registration_number, insurance_expiry, mot_expiry, vehicle_type (compliance tracking)
-**trips**: trip_date, vehicle_id, driver_id, earnings, expenses, distance_km
-**maintenance_logs**: vehicle_id, type, cost, next_service_date
-**collections**: date, driver_id, amount, payment_method, reconciled
-**expenses**: category, amount, description, vehicle_id

### Materialized View
- **kpi_daily** - Pre-calculated daily metrics (collections, expenses, profit, reconciliation counts)

### Security

- Row Level Security (RLS) enabled on all tables
- Helper functions for tenant access control
- 18+ policies enforce role-based permissions
- All queries scoped by tenant_id
- Triggers for automatic audit trail (created_at, updated_at)

## M-Pesa Integration

### Features

- Daraja API integration for payment webhooks
- Automatic transaction recording
- Manual and automatic reconciliation
- Support for Till, Paybill, and Pochi la Biashara

### Setup (Coming Soon)

Edge Functions for:
- `/api/mpesa-webhook` - Handle Daraja callbacks
- `/api/reconcile-payments` - Match transactions to collections

## Dashboard & Analytics

### KPIs Available

- Daily cash vs M-Pesa totals
- Total collections and expenses
- Net profit per vehicle/date
- Reconciled vs unreconciled payments
- Vehicle performance leaderboard
- Active vehicles and drivers

### Materialized Views

Pre-calculated daily KPIs for fast dashboard loading:
```sql
SELECT * FROM kpi_daily 
WHERE tenant_id = 'your-tenant-id' 
ORDER BY date DESC;
```

## Pricing Plans

| Plan | Target | Price (KES/month) |
|------|--------|-------------------|
| **Starter** | 1-3 vehicles | 0-500 |
| **Pro** | 4-10 vehicles | 1000-1500 |
| **Enterprise** | 10+ vehicles | Custom |

## Security

- Fleet owners and drivers sign in with a Kenyan phone number and a 4 to 6 digit PIN
- System administrators sign in with email and password, and only an active `admin_users` row can open `/admin`
- Row Level Security (RLS) on database tables, including `admin_users`
- Protected routes via middleware
- Secure session management
- HTTPS only in production

## PWA Ready

FaidaFleet is designed to work offline and can be installed as a Progressive Web App for mobile conductors and managers.

## Development

### Available Scripts

```bash
npm run dev          # Start development server (port 5000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

## Documentation

- [Database Setup Guide](supabase/DATABASE_SETUP.md)
- [Authentication Setup](docs/SUPABASE_AUTH_SETUP.md)
- [Quick Start](docs/QUICK_START.md)
- [Project Blueprint](docs/blueprint.md)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

```env
NEXT_PUBLIC_SUPABASE_URL=your-production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Roadmap

### Phase 1 (MVP) complete
- [x] Authentication system
- [x] Multi-tenant database
- [x] Basic UI components
- [x] Vehicle management with compliance tracking
- [x] Driver management
- [x] Collections tracking with reconciliation
- [x] Expenses tracking
- [x] Dashboard with KPIs
- [x] Financial Analytics & P&L Dashboard
- [x] Trip/Route Tracking & Profitability
- [x] Maintenance Scheduler
- [x] Driver Performance Analytics

### Phase 2 (In Progress)
- [ ] M-Pesa Daraja integration (ready for setup)
- [ ] Automatic transaction reconciliation
- [ ] Shift-based analytics
- [ ] Export reports (PDF/Excel)

### Phase 3
- [ ] SMS/Push notifications
- [ ] Invoice generation
- [ ] Advanced forecasting
- [ ] Email alerts

### Phase 4
- [ ] AI-powered insights
- [ ] Predictive maintenance
- [ ] Route optimization
- [ ] Mobile app (React Native)

## Contributing

This software is proprietary. Do not copy, publish, or redistribute it. Ask FaidaFleet for written permission before contributing changes.

## License

FaidaFleet is not free software and is not open source. See [LICENSE](./LICENSE). All rights reserved.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Backend powered by [Supabase](https://supabase.com/)
- Designed for Kenyan matatu operators

## Support

For questions or support, please open an issue on GitHub.

---

Built for Kenya's transport sector.
