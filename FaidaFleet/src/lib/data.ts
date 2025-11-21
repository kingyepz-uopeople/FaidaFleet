import type { Driver, Vehicle, Collection, Expense } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export const drivers: Driver[] = [
  { id: '1', name: 'John Kamau', licenseNumber: 'DL12345', phone: '0722000001', avatarUrl: PlaceHolderImages[0].imageUrl, status: 'Active' },
  { id: '2', name: 'Jane Achieng', licenseNumber: 'DL67890', phone: '0722000002', avatarUrl: PlaceHolderImages[1].imageUrl, status: 'Active' },
  { id: '3', name: 'Peter Musyoka', licenseNumber: 'DL54321', phone: '0722000003', avatarUrl: PlaceHolderImages[2].imageUrl, status: 'On Leave' },
  { id: '4', name: 'Mary Wanjiru', licenseNumber: 'DL09876', phone: '0722000004', avatarUrl: PlaceHolderImages[3].imageUrl, status: 'Active' },
  { id: '5', name: 'David Odhiambo', licenseNumber: 'DL11223', phone: '0722000005', avatarUrl: PlaceHolderImages[4].imageUrl, status: 'Inactive' },
];

export const vehicles: Vehicle[] = [
  { id: '1', regNo: 'KDA 123A', make: 'Toyota', model: 'Hiace', year: 2018, driverId: '1', status: 'Operational' },
  { id: '2', regNo: 'KDB 456B', make: 'Nissan', model: 'Matatu', year: 2020, driverId: '2', status: 'Operational' },
  { id: '3', regNo: 'KDC 789C', make: 'Isuzu', model: 'NQR', year: 2019, driverId: '3', status: 'Maintenance' },
  { id: '4', regNo: 'KDD 012D', make: 'Toyota', model: 'Coaster', year: 2021, driverId: '4', status: 'Operational' },
];

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

export const collections: Collection[] = [
  { id: '1', vehicleReg: 'KDA 123A', amount: 5000, paymentMethod: 'Cash', timestamp: today.toISOString(), reconciled: true },
  { id: '2', vehicleReg: 'KDA 123A', amount: 1500, paymentMethod: 'M-Pesa', transactionCode: 'RAB456GHI', timestamp: today.toISOString(), reconciled: true },
  { id: '3', vehicleReg: 'KDB 456B', amount: 4500, paymentMethod: 'Cash', timestamp: today.toISOString(), reconciled: true },
  { id: '4', vehicleReg: 'KDB 456B', amount: 2000, paymentMethod: 'M-Pesa', transactionCode: 'RAC789JKL', timestamp: yesterday.toISOString(), reconciled: false },
  { id: '5', vehicleReg: 'KDD 012D', amount: 6000, paymentMethod: 'Cash', timestamp: yesterday.toISOString(), reconciled: true },
  { id: '6', vehicleReg: 'KDD 012D', amount: 800, paymentMethod: 'M-Pesa', transactionCode: 'RAD012MNO', timestamp: yesterday.toISOString(), reconciled: false },
];

export const expenses: Expense[] = [
  { id: '1', vehicleReg: 'KDA 123A', type: 'Fuel', amount: 3000, timestamp: today.toISOString(), description: 'Diesel top-up' },
  { id: '2', vehicleReg: 'KDB 456B', type: 'Maintenance', amount: 5000, timestamp: yesterday.toISOString(), description: 'Oil change' },
  { id: '3', vehicleReg: 'KDC 789C', type: 'Fine', amount: 2000, timestamp: yesterday.toISOString(), description: 'Speeding ticket' },
];
