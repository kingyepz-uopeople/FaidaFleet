export type MaintenanceType = 'service' | 'repair' | 'inspection' | 'other';

export type Maintenance = {
  id: string;
  vehicle_id: string;
  date: string;
  type: MaintenanceType;
  description: string;
  cost: number | null;
  next_service_date: string | null;
  vehicles: { registration_number: string } | null;
};

export type Option = { id: string; label: string };

export const TYPE_LABELS: Record<MaintenanceType, string> = {
  service: 'Service',
  repair: 'Repair',
  inspection: 'Inspection',
  other: 'Other',
};

export const EMPTY_FORM = {
  vehicleId: '',
  type: 'service' as MaintenanceType,
  description: '',
  cost: '',
  date: new Date().toISOString().split('T')[0],
  nextServiceDate: '',
};

export type MaintenanceForm = typeof EMPTY_FORM;
