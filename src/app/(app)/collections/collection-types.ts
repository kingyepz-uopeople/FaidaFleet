export type PaymentMethod = 'cash' | 'mpesa' | 'pochi';
export type Shift = 'morning' | 'afternoon' | 'evening' | 'night';

export type Collection = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  amount: number;
  payment_method: PaymentMethod;
  mpesa_receipt: string | null;
  date: string;
  shift: Shift | null;
  reconciled: boolean;
  notes: string | null;
  recorded_by: string | null;
  vehicles: { registration_number: string } | null;
  drivers: { full_name: string; user_id: string | null } | null;
};

export type Option = { id: string; label: string };

export const EMPTY_FORM = {
  vehicleId: '',
  driverId: '',
  amount: '',
  paymentMethod: 'cash' as PaymentMethod,
  mpesaReceipt: '',
  date: new Date().toISOString().split('T')[0],
  shift: 'morning' as Shift,
  notes: '',
};

export type CollectionForm = typeof EMPTY_FORM;
