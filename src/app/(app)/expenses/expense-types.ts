export type ExpenseCategory = 'fuel' | 'maintenance' | 'insurance' | 'license' | 'parking' | 'fine' | 'other';

export type Expense = {
  id: string;
  created_at: string | null;
  vehicle_id: string | null;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string | null;
  recorded_by: string | null;
  odometer_km: number | null;
  litres: number | null;
  price_per_litre: number | null;
  pump_photo_path: string | null;
  pump_photo_expires_at: string | null;
  pump_photo_deleted_at: string | null;
  vehicles: { registration_number: string } | null;
};

export type Option = { id: string; label: string };
export type FuelLogEntry = Pick<Expense, 'id' | 'date' | 'amount' | 'litres' | 'odometer_km' | 'price_per_litre'>;

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  insurance: 'Insurance',
  license: 'Licence',
  parking: 'Parking',
  fine: 'Fine',
  other: 'Other',
};

export const EMPTY_FORM = {
  vehicleId: '',
  category: 'fuel' as ExpenseCategory,
  amount: '',
  litres: '',
  pricePerLitre: '',
  odometerKm: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
};


export type ExpenseForm = typeof EMPTY_FORM;
