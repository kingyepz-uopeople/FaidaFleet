'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash, Edit, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Collection = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  amount: number;
  payment_method: string;
  mpesa_receipt: string | null;
  date: string;
  shift: string;
  reconciled: boolean;
  vehicles: { registration_number: string };
  drivers: { full_name: string };
};

type Vehicle = {
  id: string;
  registration_number: string;
};

type Driver = {
  id: string;
  full_name: string;
};

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [searchDate, setSearchDate] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');

  const [form, setForm] = useState({
    vehicleId: '',
    driverId: '',
    amount: '',
    paymentMethod: 'cash',
    mpesaReceipt: '',
    date: new Date().toISOString().split('T')[0],
    shift: 'morning',
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const membershipResp = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const membership: any = membershipResp.data;
      if (!membership) throw new Error('No tenant found');
      const tId = membership.tenant_id;
      setTenantId(tId);

      const [collectionsRes, vehiclesRes, driversRes] = await Promise.all([
        supabase
          .from('collections')
          .select('*, vehicles(registration_number), drivers(full_name)')
          .eq('tenant_id', tId)
          .order('date', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number')
          .eq('tenant_id', tId)
          .eq('is_active', true),
        supabase
          .from('drivers')
          .select('id, full_name')
          .eq('tenant_id', tId)
          .eq('is_active', true),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;

      setCollections(collectionsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (collection?: Collection) => {
    if (collection) {
      setEditing(collection);
      setForm({
        vehicleId: collection.vehicle_id,
        driverId: collection.driver_id,
        amount: collection.amount.toString(),
        paymentMethod: collection.payment_method,
        mpesaReceipt: collection.mpesa_receipt || '',
        date: collection.date,
        shift: collection.shift,
      });
    } else {
      setEditing(null);
      setForm({
        vehicleId: '',
        driverId: '',
        amount: '',
        paymentMethod: 'cash',
        mpesaReceipt: '',
        date: new Date().toISOString().split('T')[0],
        shift: 'morning',
      });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!tenantId) throw new Error('No tenant found');
      if (!form.vehicleId || !form.driverId || !form.amount) {
        throw new Error('Vehicle, Driver, and Amount are required');
      }

      const payload: any = {
        tenant_id: tenantId,
        vehicle_id: form.vehicleId,
        driver_id: form.driverId,
        amount: parseFloat(form.amount),
        payment_method: form.paymentMethod,
        mpesa_receipt: form.mpesaReceipt || null,
        date: form.date,
        shift: form.shift,
      };

      if (editing) {
        const { error: err } = await supabase
          .from('collections')
          .update(payload)
          .eq('id', editing.id);
        if (err) throw err;
        setSuccess('Collection updated successfully');
      } else {
        const { error: err } = await supabase
          .from('collections')
          .insert([payload]);
        if (err) throw err;
        setSuccess('Collection recorded successfully');
      }

      setOpen(false);
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this collection record?')) return;

    try {
      const { error: err } = await supabase
        .from('collections')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setSuccess('Collection deleted successfully');
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'mpesa':
        return 'bg-green-100 text-green-800';
      case 'cash':
        return 'bg-blue-100 text-blue-800';
      case 'pochi':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredCollections = collections.filter((c) => {
    if (searchDate && !c.date.startsWith(searchDate)) return false;
    if (filterMethod !== 'all' && c.payment_method !== filterMethod) return false;
    return true;
  });

  const totalCollections = filteredCollections.reduce((sum, c) => sum + c.amount, 0);
  const reconciliationRate = filteredCollections.length > 0
    ? Math.round((filteredCollections.filter((c) => c.reconciled).length / filteredCollections.length) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Collections</h1>
          <p className="text-gray-600 dark:text-gray-400">Track daily revenue and collections</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
              <PlusCircle className="mr-2 h-4 w-4" />
              Record Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Collection' : 'Record Collection'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Vehicle *</Label>
                <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.registration_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Driver *</Label>
                <Select value={form.driverId} onValueChange={(v) => setForm({ ...form, driverId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount (KES) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label>Payment Method *</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="pochi">Pochi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.paymentMethod === 'mpesa' && (
                <div>
                  <Label>M-Pesa Receipt/Transaction Code</Label>
                  <Input
                    value={form.mpesaReceipt}
                    onChange={(e) => setForm({ ...form, mpesaReceipt: e.target.value })}
                    placeholder="e.g., ABCDEF123456"
                  />
                </div>
              )}

              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Shift *</Label>
                <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-blue-600">
                  {submitting ? 'Saving...' : editing ? 'Update' : 'Record'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50 text-green-800 border-green-200"><AlertDescription>{success}</AlertDescription></Alert>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">KES {totalCollections.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{filteredCollections.length} records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">KES {filteredCollections.length > 0 ? Math.round(totalCollections / filteredCollections.length) : 0}</p>
            <p className="text-sm text-gray-500">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reconciliation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{reconciliationRate}%</p>
            <p className="text-sm text-gray-500">Verified transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label className="text-sm">Date</Label>
            <Input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <Label className="text-sm">Payment Method</Label>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="pochi">Pochi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => { setSearchDate(''); setFilterMethod('all'); }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Collections Table */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Records</CardTitle>
          <CardDescription>{filteredCollections.length} records found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No collection records found</p>
              <Button onClick={() => handleOpenDialog()} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Record First Collection
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollections.map((collection) => (
                    <TableRow key={collection.id}>
                      <TableCell>{format(new Date(collection.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="font-medium">{collection.vehicles?.registration_number}</TableCell>
                      <TableCell>{collection.drivers?.full_name}</TableCell>
                      <TableCell className="font-bold">KES {collection.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getPaymentMethodColor(collection.payment_method)}>
                          {collection.payment_method.charAt(0).toUpperCase() + collection.payment_method.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{collection.shift}</TableCell>
                      <TableCell>
                        <Badge className={collection.reconciled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {collection.reconciled ? 'Verified' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(collection)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(collection.id)}>
                            <Trash className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
