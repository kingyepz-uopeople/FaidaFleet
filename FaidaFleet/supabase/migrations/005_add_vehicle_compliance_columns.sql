-- Add missing columns to vehicles table for compliance tracking
-- This migration adds columns needed for the Vehicles Management feature

ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS insurance_expiry DATE;

ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS mot_expiry DATE;

ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS vehicle_type TEXT CHECK (vehicle_type IN ('psv', 'cargo', 'pickup', 'other'));

-- Create index for vehicle compliance tracking
CREATE INDEX IF NOT EXISTS vehicles_tenant_active 
ON public.vehicles(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS vehicles_compliance 
ON public.vehicles(insurance_expiry, mot_expiry);
