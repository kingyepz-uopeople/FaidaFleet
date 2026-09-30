export type Driver = {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  avatarUrl: string;
  status: 'Active' | 'Inactive' | 'On Leave';
};

export type Vehicle = {
  id: string;
  regNo: string;
  make: string;
  model: string;
  year: number;
  driverId: string;
  status: 'Operational' | 'Maintenance' | 'Out of Service';
};

export type Collection = {
  id: string;
  vehicleReg: string;
  amount: number;
  paymentMethod: 'Cash' | 'M-Pesa';
  transactionCode?: string;
  timestamp: string;
  reconciled: boolean;
};

export type Expense = {
  id: string;
  vehicleReg: string;
  type: 'Fuel' | 'Maintenance' | 'Fine' | 'Other';
  amount: number;
  timestamp: string;
  description: string;
};
