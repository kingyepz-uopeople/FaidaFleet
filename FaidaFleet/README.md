# 🚦 FaidaFleet - Fleet Management System

FaidaFleet is a comprehensive fleet management web application designed for matatu and logistics operators in Kenya. It provides digital tracking of vehicles, drivers, daily collections (cash & M-Pesa), expenses, and profitability dashboards.

## 🎯 Core Features

- **Multi-Tenant Architecture** - Support multiple fleet owners with isolated data
- **Role-Based Access Control** - Owner, Admin, Accountant, and Driver roles
- **Vehicle & Driver Management** - Track fleet assets and assignments
- **Financial Tracking** - Daily collections, expenses, and profitability
- **M-Pesa Integration** - Automatic reconciliation with Daraja API
- **Real-time Dashboard** - KPIs, analytics, and performance metrics
- **Secure Authentication** - Supabase Auth with email/password and OAuth

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 18, TypeScript |
| **UI Components** | Tailwind CSS, shadcn/ui |
| **Backend & Database** | Supabase (PostgreSQL + RLS + Auth) |
| **Authentication** | Supabase Auth (Email, Google OAuth) |
| **Payments** | Safaricom Daraja API (M-Pesa) |
| **Hosting** | Vercel |

## 🚀 Getting Started

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
   
   Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Set up the database**
   - Go to your Supabase Dashboard → SQL Editor
   - Run the migration from `supabase/migrations/001_initial_schema.sql`
   - See `supabase/DATABASE_SETUP.md` for detailed instructions

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:9002`

## 📁 Project Structure

```
FaidaFleet/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── (app)/             # Protected app routes
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── vehicles/      # Vehicle management
│   │   │   ├── drivers/       # Driver management
│   │   │   ├── collections/   # Revenue tracking
│   │   │   ├── expenses/      # Expense tracking
│   │   │   └── settings/      # App settings
│   │   ├── auth/              # Auth callbacks & errors
│   │   ├── login/             # Login page
│   │   ├── signup/            # Sign-up page
│   │   └── reset-password/    # Password reset
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
│   ├── migrations/            # Database migrations
│   └── DATABASE_SETUP.md      # Setup guide
├── docs/
│   └── blueprint.md           # Project blueprint
└── SUPABASE_AUTH_SETUP.md     # Auth setup guide
```

## 👥 Multi-Tenancy & Roles

### How It Works

- Each **tenant** represents a fleet company
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

## 🗄️ Database Schema

### Core Tables

- **tenants** - Fleet companies
- **profiles** - User profiles (extends auth.users)
- **memberships** - User-tenant relationships with roles
- **vehicles** - Vehicle/matatu records
- **drivers** - Driver information
- **driver_assignments** - Driver-vehicle assignments
- **collections** - Daily revenue records
- **mpesa_transactions** - M-Pesa webhook data
- **expenses** - Daily expenses
- **maintenance_logs** - Vehicle maintenance history

### Security

- Row Level Security (RLS) enabled on all tables
- Helper functions for tenant access control
- Policies enforce role-based permissions
- All queries scoped by tenant_id

## 💳 M-Pesa Integration

### Features

- Daraja API integration for payment webhooks
- Automatic transaction recording
- Manual and automatic reconciliation
- Support for Till, Paybill, and Pochi la Biashara

### Setup (Coming Soon)

Edge Functions for:
- `/api/mpesa-webhook` - Handle Daraja callbacks
- `/api/reconcile-payments` - Match transactions to collections

## 📊 Dashboard & Analytics

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

## 💰 Pricing Plans

| Plan | Target | Price (KES/month) |
|------|--------|-------------------|
| **Starter** | 1-3 vehicles | 0-500 |
| **Pro** | 4-10 vehicles | 1000-1500 |
| **Enterprise** | 10+ vehicles | Custom |

## 🔐 Security

- Supabase Auth with email/password and OAuth
- Row Level Security (RLS) on all database tables
- Protected routes via middleware
- Secure session management
- HTTPS only in production

## 📱 PWA Ready

FaidaFleet is designed to work offline and can be installed as a Progressive Web App for mobile conductors and managers.

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server (port 9002)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

## 📚 Documentation

- [Database Setup Guide](supabase/DATABASE_SETUP.md)
- [Authentication Setup](SUPABASE_AUTH_SETUP.md)
- [Project Blueprint](docs/blueprint.md)

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

```env
NEXT_PUBLIC_SUPABASE_URL=your-production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-key
```

## 🗺️ Roadmap

### Phase 1 (MVP) ✅
- [x] Authentication system
- [x] Multi-tenant database
- [x] Basic UI components
- [ ] Vehicle management
- [ ] Driver management
- [ ] Collections tracking
- [ ] Expenses tracking
- [ ] Dashboard with KPIs

### Phase 2
- [ ] Maintenance logs
- [ ] M-Pesa Daraja integration
- [ ] Automatic reconciliation
- [ ] Shift analytics

### Phase 3
- [ ] SMS/Push notifications
- [ ] Invoice generation
- [ ] Export reports
- [ ] Advanced analytics

### Phase 4
- [ ] AI-powered insights
- [ ] Predictive maintenance
- [ ] Route optimization

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Backend powered by [Supabase](https://supabase.com/)
- Designed for Kenyan matatu operators

## 📞 Support

For questions or support, please open an issue on GitHub.

---

Made with ❤️ for Kenya's transport sector
