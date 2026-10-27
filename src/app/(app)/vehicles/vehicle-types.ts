export type Vehicle = {
  id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  capacity: number | null;
  vehicle_type: 'psv' | 'cargo' | 'pickup' | 'other' | null;
  insurance_expiry: string | null;
  mot_expiry: string | null;
  is_active: boolean;
};

export const EMPTY_FORM = {
  registration: '',
  make: '',
  model: '',
  year: new Date().getFullYear().toString(),
  capacity: '',
  vehicleType: 'psv' as NonNullable<Vehicle['vehicle_type']>,
  insuranceExpiry: '',
  motExpiry: '',
};

export type VehicleForm = typeof EMPTY_FORM;
