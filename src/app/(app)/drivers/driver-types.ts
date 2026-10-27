export type Driver = {
  id: string;
  full_name: string;
  phone: string;
  license_number: string | null;
  license_expiry: string | null;
  id_number: string | null;
  is_active: boolean;
};

export type Vehicle = {
  id: string;
  registration_number: string;
};

export type Assignment = {
  driver_id: string;
  vehicle_id: string;
  vehicles: { registration_number: string } | null;
};

export const EMPTY_DRIVER = {
  full_name: '',
  phone: '',
  pin: '',
  pin_confirm: '',
  license_number: '',
  license_expiry: '',
  id_number: '',
};


export type DriverForm = typeof EMPTY_DRIVER;
export type EditDriverForm = { full_name: string; license_number: string; license_expiry: string };
export type AssignDriverForm = { driver_id: string; vehicle_id: string; start_date: string };
