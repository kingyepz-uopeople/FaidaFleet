-- Add Trips table for trip/route tracking
create table public.trips (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  trip_date date not null default current_date,
  start_time time,
  end_time time,
  start_location text,
  end_location text,
  distance_km numeric(8,2),
  fuel_consumed numeric(6,2),
  earnings numeric(10,2) check (earnings >= 0),
  expenses numeric(10,2) default 0,
  status text default 'completed' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add indexes for common queries
create index trips_tenant_id on public.trips(tenant_id);
create index trips_vehicle_id on public.trips(vehicle_id);
create index trips_driver_id on public.trips(driver_id);
create index trips_trip_date on public.trips(trip_date);

-- Add updated_at trigger for trips
create trigger set_updated_at before update on public.trips
  for each row execute function public.handle_updated_at();

-- Update vehicles table to track insurance and MOT expiry
alter table public.vehicles add column if not exists insurance_expiry date;
alter table public.vehicles add column if not exists mot_expiry date;
alter table public.vehicles add column if not exists vehicle_type text check (vehicle_type in ('psv', 'cargo', 'pickup', 'other'));

-- Create index for vehicle compliance tracking
create index vehicles_tenant_active on public.vehicles(tenant_id, is_active);
