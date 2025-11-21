# FaidaFleet Database Schema

## Overview
Complete database structure for fleet management system with multi-tenant architecture.

---

## 🚗 Feature 1: Vehicles Management

### `vehicles` Table
```sql
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  make TEXT,                          -- e.g., "Toyota"
  model TEXT,                         -- e.g., "Hiace"
  year INTEGER,                       -- e.g., 2020
  capacity INTEGER,                   -- e.g., 14 (passenger count)
  vehicle_type TEXT,                  -- 'psv', 'cargo', 'pickup', 'other'
  insurance_expiry DATE,              -- Compliance tracking
  mot_expiry DATE,                    -- Compliance tracking
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, registration_number)
);

INDEXES:
- vehicles_tenant_active (tenant_id, is_active)
```

---

## 📊 Feature 2: Financial Analytics & Reports

### `collections` Table (Revenue Tracking)
```sql
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT CHECK (shift IN ('morning', 'afternoon', 'evening', 'night')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT CHECK (payment_method IN ('cash', 'mpesa', 'pochi')),
  mpesa_receipt TEXT,
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INDEXES:
- collections_date (tenant_id, date)
- collections_vehicle_id (vehicle_id)
- collections_driver_id (driver_id)
```

### `expenses` Table (Cost Tracking)
```sql
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT CHECK (category IN ('fuel', 'maintenance', 'insurance', 'license', 'parking', 'other')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  receipt_url TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INDEXES:
- expenses_date (tenant_id, date)
- expenses_vehicle_id (vehicle_id)
```

### Materialized View: `kpi_daily`
```sql
-- Auto-calculates daily metrics
SELECT
  tenant_id,
  date,
  SUM(collections.amount) AS total_collections,
  COALESCE(SUM(expenses.amount), 0) AS total_expenses,
  SUM(collections.amount) - COALESCE(SUM(expenses.amount), 0) AS net_profit,
  COUNT(*) FILTER (WHERE reconciled = true) AS reconciled_count
FROM collections
LEFT JOIN expenses ON expenses.tenant_id = collections.tenant_id 
  AND expenses.date = collections.date
GROUP BY tenant_id, date;
```

---

## 🛣️ Feature 3: Trip & Route Tracking

### `trips` Table
```sql
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME,
  end_time TIME,
  start_location TEXT,
  end_location TEXT,
  distance_km NUMERIC(8,2),
  fuel_consumed NUMERIC(6,2),
  earnings NUMERIC(10,2) CHECK (earnings >= 0),
  expenses NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INDEXES:
- trips_tenant_id (tenant_id)
- trips_vehicle_id (vehicle_id)
- trips_driver_id (driver_id)
- trips_trip_date (trip_date)
```

---

## 🔧 Feature 4: Maintenance Scheduler

### `maintenance_logs` Table
```sql
CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT CHECK (type IN ('service', 'repair', 'inspection', 'other')),
  description TEXT NOT NULL,
  cost NUMERIC(10,2) CHECK (cost >= 0),
  odometer_reading INTEGER,
  next_service_date DATE,
  garage_name TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INDEXES:
- maintenance_vehicle_id (vehicle_id)
- maintenance_date (date)
- maintenance_next_service (next_service_date)
```

---

## 👥 Feature 5: Driver Performance & Analytics

### `drivers` Table
```sql
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_number TEXT,
  license_expiry DATE,
  id_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

INDEXES:
- drivers_tenant_id (tenant_id)
- drivers_license_expiry (license_expiry)
```

### `driver_assignments` Table (History Tracking)
```sql
CREATE TABLE public.driver_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

INDEXES:
- assignments_vehicle_driver (vehicle_id, driver_id)
- assignments_is_current (is_current)
```

---

## 🏢 Core Tenant & User Tables

### `tenants` Table
```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_name TEXT,
  phone TEXT,
  email TEXT,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `profiles` Table
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `memberships` Table (User-Tenant Relationship)
```sql
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'accountant', 'driver')),
  is_active BOOLEAN DEFAULT TRUE,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

INDEXES:
- memberships_user_tenant (user_id, tenant_id)
- memberships_role (role)
```

---

## Summary Statistics

| Table | Purpose | Records |
|-------|---------|---------|
| `vehicles` | Fleet registration & compliance | ~10-500 per tenant |
| `collections` | Daily revenue tracking | ~100-10k per tenant |
| `expenses` | Cost tracking | ~50-5k per tenant |
| `trips` | Individual trip records | ~100-10k per tenant |
| `maintenance_logs` | Service history | ~20-1k per tenant |
| `drivers` | Driver roster | ~5-100 per tenant |
| `driver_assignments` | Driver-vehicle history | ~50-5k per tenant |

---

## Key Design Patterns

✅ **Multi-tenant isolation** - All tables have `tenant_id` foreign key  
✅ **Audit trails** - `created_at`, `updated_at` on all main tables  
✅ **Compliance tracking** - Insurance & MOT expiry dates  
✅ **Financial accuracy** - NUMERIC type for all monetary values  
✅ **Data integrity** - CHECK constraints on enums and amounts  
✅ **Performance** - Strategic indexes on frequently queried columns  
✅ **Referential integrity** - Cascading deletes on tenant deletion  

---

## Migration Files

- `001_initial_schema.sql` - Core tables & tenancy setup
- `002_fix_onboarding.sql` - Onboarding improvements
- `003_admin_tables.sql` - Admin features
- `004_add_trips_table.sql` - Trips & vehicle compliance columns
