'use client';

import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash, Edit, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Vehicle = { id: string; registration_number: string; make: string; model: string; year: number; capacity: number; vehicle_type: string; insurance_expiry: string | null; mot_expiry: string | null; is_active: boolean };

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({ registration: '', make: '', model: '', year: new Date().getFullYear().toString(), capacity: '', vehicleType: 'psv', insuranceExpiry: '', motExpiry: '' });
  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const membershipResp = await supabase.from('memberships').select('tenant_id').eq('user_id', user.id).eq('is_active', true).single();
      const membership: any = membershipResp.data;
      if (!membership) throw new Error('No tenant found');
      const tId = membership.tenant_id;
      setTenantId(tId);
      const { data, error: err } = await supabase.from('vehicles').select('*').eq('tenant_id', tId).order('registration_number');
      if (err) throw err;
      setVehicles(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditing(vehicle);
      setForm({ registration: vehicle.registration_number, make: vehicle.make || '', model: vehicle.model || '', year: vehicle.year?.toString() || new Date().getFullYear().toString(), capacity: vehicle.capacity?.toString() || '', vehicleType: vehicle.vehicle_type || 'psv', insuranceExpiry: vehicle.insurance_expiry || '', motExpiry: vehicle.mot_expiry || '' });
    } else {
      setEditing(null);
      setForm({ registration: '', make: '', model: '', year: new Date().getFullYear().toString(), capacity: '', vehicleType: 'psv', insuranceExpiry: '', motExpiry: '' });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!tenantId) throw new Error('No tenant found');
      if (!form.registration) throw new Error('Registration number is required');
      const payload: any = { tenant_id: tenantId, registration_number: form.registration.toUpperCase(), make: form.make || null, model: form.model || null, year: form.year ? parseInt(form.year) : null, capacity: form.capacity ? parseInt(form.capacity) : null, vehicle_type: form.vehicleType, insurance_expiry: form.insuranceExpiry || null, mot_expiry: form.motExpiry || null };
      if (editing) {
        const { error: err } = await supabase.from('vehicles').update(payload).eq('id', editing.id);
        if (err) throw err;
        setSuccess('Vehicle updated successfully');
      } else {
        const { error: err } = await supabase.from('vehicles').insert([{ ...payload, is_active: true }]);
        if (err) throw err;
        setSuccess('Vehicle added successfully');
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
    if (!window.confirm('Delete this vehicle?')) return;
    try {
      const { error: err } = await supabase.from('vehicles').delete().eq('id', id);
      if (err) throw err;
      setSuccess('Vehicle deleted successfully');
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const isExpired = (date: string | null) => date && new Date(date) < new Date();
  const isExpiringSoon = (date: string | null, days = 30) => date && Math.floor((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= days && Math.floor((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) >= 0;
  const getStatus = (v: Vehicle) => isExpired(v.insurance_expiry) || isExpired(v.mot_expiry) ? 'Expired' : isExpiringSoon(v.insurance_expiry) || isExpiringSoon(v.mot_expiry) ? 'Warning' : 'Active';

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => v.is_active).length;
  const complianceIssues = vehicles.filter(v => getStatus(v) !== 'Active').length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vehicles</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage fleet vehicles and compliance</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700"><PlusCircle className="mr-2 h-4 w-4" />Add Vehicle</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Registration Number *</Label><Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="e.g., KCA 123A" required /></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Toyota" /></div><div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Hiace" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div><div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="14" /></div></div>
              <div><Label>Vehicle Type *</Label><Select value={form.vehicleType} onValueChange={(v) => setForm({ ...form, vehicleType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="psv">PSV (Public)</SelectItem><SelectItem value="cargo">Cargo</SelectItem><SelectItem value="pickup">Pickup</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              <div><Label>Insurance Expiry</Label><Input type="date" value={form.insuranceExpiry} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} /></div>
              <div><Label>MOT Expiry</Label><Input type="date" value={form.motExpiry} onChange={(e) => setForm({ ...form, motExpiry: e.target.value })} /></div>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting} className="bg-blue-600">{submitting ? 'Saving...' : editing ? 'Update' : 'Add'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50 text-green-800 border-green-200"><AlertDescription>{success}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-lg">Total Vehicles</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">{totalVehicles}</p><p className="text-sm text-gray-500">{activeVehicles} active</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Compliance Issues</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-600">{complianceIssues}</p><p className="text-sm text-gray-500">Expired or expiring soon</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Compliance Rate</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">{totalVehicles > 0 ? Math.round(((totalVehicles - complianceIssues) / totalVehicles) * 100) : 0}%</p><p className="text-sm text-gray-500">Vehicles in compliance</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Fleet Vehicles</CardTitle><CardDescription>{vehicles.length} vehicles in your fleet</CardDescription></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div> : vehicles.length === 0 ? <div className="text-center py-8 text-gray-500"><p>No vehicles yet</p><Button onClick={() => handleOpenDialog()} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" />Add Your First Vehicle</Button></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Registration</TableHead><TableHead>Make/Model</TableHead><TableHead>Type</TableHead><TableHead>Insurance</TableHead><TableHead>MOT</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{vehicles.map((vehicle) => { const status = getStatus(vehicle); const statusColor = status === 'Active' ? 'bg-green-100 text-green-800' : status === 'Warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'; return (<TableRow key={vehicle.id}><TableCell className="font-bold">{vehicle.registration_number}</TableCell><TableCell>{vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : '—'}</TableCell><TableCell className="capitalize">{vehicle.vehicle_type || '—'}</TableCell><TableCell>{vehicle.insurance_expiry ? (<div className="flex items-center gap-1">{isExpired(vehicle.insurance_expiry) && <AlertTriangle className="h-4 w-4 text-red-600" />}{format(new Date(vehicle.insurance_expiry), 'MMM dd, yy')}</div>) : '—'}</TableCell><TableCell>{vehicle.mot_expiry ? (<div className="flex items-center gap-1">{isExpired(vehicle.mot_expiry) && <AlertTriangle className="h-4 w-4 text-red-600" />}{format(new Date(vehicle.mot_expiry), 'MMM dd, yy')}</div>) : '—'}</TableCell><TableCell><Badge className={statusColor}>{status}</Badge></TableCell><TableCell><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => handleOpenDialog(vehicle)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDelete(vehicle.id)}><Trash className="h-4 w-4 text-red-600" /></Button></div></TableCell></TableRow>); })}</TableBody></Table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
