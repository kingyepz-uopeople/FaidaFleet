export type Trip = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  trip_date: string;
  distance_km: number | null;
  earnings: number | null;
  expenses: number | null;
  start_location: string | null;
  end_location: string | null;
  notes: string | null;
  recorded_by: string | null;
  vehicles: { registration_number: string } | null;
  drivers: { full_name: string; user_id: string | null } | null;
};

export type Option = { id: string; label: string };

export const EMPTY_FORM = {
  vehicleId: '',
  driverId: '',
  tripDate: new Date().toISOString().split('T')[0],
  distanceKm: '',
  earnings: '',
  expenses: '',
  startLocation: '',
  endLocation: '',
  notes: '',
};


export type TripForm = typeof EMPTY_FORM;
