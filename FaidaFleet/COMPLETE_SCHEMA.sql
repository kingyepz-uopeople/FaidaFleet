-- ============================================
-- FAIDAFLEET COMPLETE DATABASE SCHEMA
-- Multi-tenant Fleet Management System
-- All 5 Features: Vehicles, Analytics, Trips, Maintenance, Driver Performance
-- ============================================

-- ============================================
-- 1. ENABLE EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. CORE TENANCY & USER TABLES
-- ============================================

-- Tenants (Fleet Companies)
CREATE TABLE IF NOT EXISTS public.tenants (
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

-- User Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memberships (User-Tenant Relationship with Roles)
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'driver')),
  is_active BOOLEAN DEFAULT TRUE,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_tenant ON public.memberships(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS memberships_role ON public.memberships(role);

-- ============================================
-- 3. FEATURE 1: VEHICLES MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  capacity INTEGER,
  route TEXT,
  vehicle_type TEXT CHECK (vehicle_type IN ('psv', 'cargo', 'pickup', 'other')),
  insurance_expiry DATE,
  mot_expiry DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, registration_number)
);

CREATE INDEX IF NOT EXISTS vehicles_tenant_active ON public.vehicles(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS vehicles_compliance ON public.vehicles(insurance_expiry, mot_expiry);

-- ============================================
-- 4. FEATURE 5: DRIVER MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS drivers_tenant_id ON public.drivers(tenant_id);
CREATE INDEX IF NOT EXISTS drivers_license_expiry ON public.drivers(license_expiry);

-- Driver Assignments (Track driver-vehicle history)
CREATE TABLE IF NOT EXISTS public.driver_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS assignments_vehicle_driver ON public.driver_assignments(vehicle_id, driver_id);
CREATE INDEX IF NOT EXISTS assignments_is_current ON public.driver_assignments(is_current);

-- ============================================
-- 5. FEATURE 2: FINANCIAL TRACKING
-- ============================================

-- Collections (Daily Revenue)
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT CHECK (shift IN ('morning', 'afternoon', 'evening', 'night')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'pochi')),
  mpesa_receipt TEXT,
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS collections_date ON public.collections(tenant_id, date);
CREATE INDEX IF NOT EXISTS collections_vehicle_id ON public.collections(vehicle_id);
CREATE INDEX IF NOT EXISTS collections_driver_id ON public.collections(driver_id);

-- Expenses (Cost Tracking)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL CHECK (category IN ('fuel', 'maintenance', 'insurance', 'license', 'parking', 'other')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  receipt_url TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expenses_date ON public.expenses(tenant_id, date);
CREATE INDEX IF NOT EXISTS expenses_vehicle_id ON public.expenses(vehicle_id);

-- ============================================
-- 6. FEATURE 3: TRIPS & ROUTE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS trips_tenant_id ON public.trips(tenant_id);
CREATE INDEX IF NOT EXISTS trips_vehicle_id ON public.trips(vehicle_id);
CREATE INDEX IF NOT EXISTS trips_driver_id ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS trips_trip_date ON public.trips(trip_date);

-- ============================================
-- 7. FEATURE 4: MAINTENANCE SCHEDULER
-- ============================================

CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('service', 'repair', 'inspection', 'other')),
  description TEXT NOT NULL,
  cost NUMERIC(10,2) CHECK (cost >= 0),
  odometer_reading INTEGER,
  next_service_date DATE,
  garage_name TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maintenance_vehicle_id ON public.maintenance_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS maintenance_date ON public.maintenance_logs(date);
CREATE INDEX IF NOT EXISTS maintenance_next_service ON public.maintenance_logs(next_service_date);

-- ============================================
-- 8. M-PESA TRANSACTIONS (Optional Integration)
-- ============================================

CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  trans_id TEXT UNIQUE NOT NULL,
  trans_time TIMESTAMPTZ NOT NULL,
  trans_amount NUMERIC(10,2) NOT NULL,
  business_short_code TEXT,
  bill_ref_number TEXT,
  msisdn TEXT,
  first_name TEXT,
  last_name TEXT,
  org_account_balance NUMERIC(10,2),
  third_party_trans_id TEXT,
  phone_number TEXT,
  matched_collection_id UUID REFERENCES public.collections(id),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- Get all tenant IDs the current user belongs to
CREATE OR REPLACE FUNCTION public.current_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
  SELECT tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

-- Check if user has specific role in tenant
CREATE OR REPLACE FUNCTION public.has_tenant_role(tenant_uuid UUID, required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = auth.uid()
      AND tenant_id = tenant_uuid
      AND role = required_role
      AND is_active = true
  );
$$;

-- ============================================
-- 10. MATERIALIZED VIEW FOR DASHBOARD KPIs
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.kpi_daily AS
SELECT
  c.tenant_id,
  c.date,
  COUNT(DISTINCT c.vehicle_id) AS active_vehicles,
  COUNT(DISTINCT c.driver_id) AS active_drivers,
  SUM(c.amount) FILTER (WHERE c.payment_method = 'cash') AS cash_total,
  SUM(c.amount) FILTER (WHERE c.payment_method = 'mpesa') AS mpesa_total,
  SUM(c.amount) FILTER (WHERE c.payment_method = 'pochi') AS pochi_total,
  SUM(c.amount) AS total_collections,
  COUNT(*) FILTER (WHERE c.reconciled = TRUE) AS reconciled_count,
  COUNT(*) FILTER (WHERE c.reconciled = FALSE) AS unreconciled_count,
  COALESCE(SUM(e.amount), 0) AS total_expenses,
  SUM(c.amount) - COALESCE(SUM(e.amount), 0) AS net_profit
FROM public.collections c
LEFT JOIN public.expenses e ON e.tenant_id = c.tenant_id AND e.date = c.date
GROUP BY c.tenant_id, c.date;

CREATE UNIQUE INDEX IF NOT EXISTS kpi_daily_unique ON public.kpi_daily(tenant_id, date);

-- Function to refresh KPI view
CREATE OR REPLACE FUNCTION public.refresh_kpi_daily()
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kpi_daily;
$$;

-- ============================================
-- 11. TRIGGERS FOR UPDATED_AT
-- ============================================

DROP TRIGGER IF EXISTS set_updated_at ON public.tenants;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.drivers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.vehicles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.collections;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.expenses;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.maintenance_logs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.trips;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 12. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 13. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Tenants RLS
DROP POLICY IF EXISTS "Users can view their tenants" ON public.tenants;
CREATE POLICY "Users can view their tenants" ON public.tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

-- Profiles RLS
DROP POLICY IF EXISTS "Users can view their profile" ON public.profiles;
CREATE POLICY "Users can view their profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
CREATE POLICY "Users can update their profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Memberships RLS
DROP POLICY IF EXISTS "Users can view their memberships" ON public.memberships;
CREATE POLICY "Users can view their memberships" ON public.memberships
  FOR SELECT USING (user_id = auth.uid() OR invited_by = auth.uid());

-- Vehicles RLS
DROP POLICY IF EXISTS "Users can view tenant vehicles" ON public.vehicles;
CREATE POLICY "Users can view tenant vehicles" ON public.vehicles
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Admins can manage vehicles" ON public.vehicles;
CREATE POLICY "Admins can manage vehicles" ON public.vehicles
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true)
  );

-- Drivers RLS
DROP POLICY IF EXISTS "Users can view tenant drivers" ON public.drivers;
CREATE POLICY "Users can view tenant drivers" ON public.drivers
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Admins can manage drivers" ON public.drivers;
CREATE POLICY "Admins can manage drivers" ON public.drivers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true)
  );

-- Driver Assignments RLS
DROP POLICY IF EXISTS "Users can view assignments" ON public.driver_assignments;
CREATE POLICY "Users can view assignments" ON public.driver_assignments
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

-- Collections RLS
DROP POLICY IF EXISTS "Users can view collections" ON public.collections;
CREATE POLICY "Users can view collections" ON public.collections
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Team can record collections" ON public.collections;
CREATE POLICY "Team can record collections" ON public.collections
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant') AND is_active = true)
  );

-- Expenses RLS
DROP POLICY IF EXISTS "Users can view expenses" ON public.expenses;
CREATE POLICY "Users can view expenses" ON public.expenses
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Team can record expenses" ON public.expenses;
CREATE POLICY "Team can record expenses" ON public.expenses
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant') AND is_active = true)
  );

-- Trips RLS
DROP POLICY IF EXISTS "Users can view trips" ON public.trips;
CREATE POLICY "Users can view trips" ON public.trips
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Team can record trips" ON public.trips;
CREATE POLICY "Team can record trips" ON public.trips
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant') AND is_active = true)
  );

-- Maintenance RLS
DROP POLICY IF EXISTS "Users can view maintenance" ON public.maintenance_logs;
CREATE POLICY "Users can view maintenance" ON public.maintenance_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Team can record maintenance" ON public.maintenance_logs;
CREATE POLICY "Team can record maintenance" ON public.maintenance_logs
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant') AND is_active = true)
  );

-- M-Pesa Transactions RLS
DROP POLICY IF EXISTS "Users can view mpesa transactions" ON public.mpesa_transactions;
CREATE POLICY "Users can view mpesa transactions" ON public.mpesa_transactions
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid() AND is_active = true)
  );

-- ============================================
-- 14. GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================
-- END OF SCHEMA
-- ============================================
