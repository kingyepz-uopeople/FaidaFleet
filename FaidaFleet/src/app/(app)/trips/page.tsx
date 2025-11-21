'use client';
import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash, Edit } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Trip = { id: string; trip_date: string; vehicle_id: string; driver_id: string; distance_km: number; earnings: number; expenses: number; vehicles: { registration_number: string }; drivers: { full_name: string } };

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({ vehicleId: '', driverId: '', tripDate: new Date().toISOString().split('T')[0], distanceKm: '', earnings: '', expenses: '', startLocation: '', endLocation: '' });
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

      const [tripsRes, vehiclesRes, driversRes] = await Promise.all([
        supabase.from('trips').select('*, vehicles(registration_number), drivers(full_name)').eq('tenant_id', tId).order('trip_date', { ascending: false }),
        supabase.from('vehicles').select('id, registration_number').eq('tenant_id', tId).eq('is_active', true),
        supabase.from('drivers').select('id, full_name').eq('tenant_id', tId).eq('is_active', true),
      ]);

      if (tripsRes.error) throw tripsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;

      setTrips(tripsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (trip?: Trip) => {
    if (trip) {
      setEditing(trip);
      setForm({ vehicleId: trip.vehicle_id, driverId: trip.driver_id, tripDate: trip.trip_date, distanceKm: trip.distance_km?.toString() || '', earnings: trip.earnings?.toString() || '', expenses: trip.expenses?.toString() || '', startLocation: '', endLocation: '' });
    } else {
      setEditing(null);
      setForm({ vehicleId: '', driverId: '', tripDate: new Date().toISOString().split('T')[0], distanceKm: '', earnings: '', expenses: '', startLocation: '', endLocation: '' });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!tenantId) throw new Error('No tenant found');
      const payload: any = { tenant_id: tenantId, vehicle_id: form.vehicleId, driver_id: form.driverId, trip_date: form.tripDate, distance_km: parseFloat(form.distanceKm) || 0, earnings: parseFloat(form.earnings) || 0, expenses: parseFloat(form.expenses) || 0, start_location: form.startLocation || null, end_location: form.endLocation || null };
      if (editing) {
        const { error: err } = await supabase.from('trips').update(payload).eq('id', editing.id);
        if (err) throw err;
        setSuccess('Trip updated successfully');
      } else {
        const { error: err } = await supabase.from('trips').insert([payload]);
        if (err) throw err;
        setSuccess('Trip recorded successfully');
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
    if (!window.confirm('Delete this trip?')) return;
    try {
      const { error: err } = await supabase.from('trips').delete().eq('id', id);
      if (err) throw err;
      setSuccess('Trip deleted successfully');
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalEarnings = trips.reduce((sum, t) => sum + (t.earnings || 0), 0);
  const totalExpenses = trips.reduce((sum, t) => sum + (t.expenses || 0), 0);
  const totalProfit = totalEarnings - totalExpenses;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Trips & Routes</h1><p className="text-gray-600 dark:text-gray-400">Track individual trips and earnings</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700"><PlusCircle className="mr-2 h-4 w-4" />Record Trip</Button></DialogTrigger><DialogContent className="max-w-md max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? 'Edit Trip' : 'Record Trip'}</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="space-y-4"><div><Label>Vehicle *</Label><Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>))}</SelectContent></Select></div><div><Label>Driver *</Label><Select value={form.driverId} onValueChange={(v) => setForm({ ...form, driverId: v })}><SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger><SelectContent>{drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>))}</SelectContent></Select></div><div><Label>Trip Date *</Label><Input type="date" value={form.tripDate} onChange={(e) => setForm({ ...form, tripDate: e.target.value })} required /></div><div><Label>Distance (KM)</Label><Input type="number" step="0.01" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} placeholder="0.00" /></div><div><Label>Earnings (KES) *</Label><Input type="number" step="0.01" value={form.earnings} onChange={(e) => setForm({ ...form, earnings: e.target.value })} placeholder="0.00" required /></div><div><Label>Expenses (KES)</Label><Input type="number" step="0.01" value={form.expenses} onChange={(e) => setForm({ ...form, expenses: e.target.value })} placeholder="0.00" /></div>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting} className="bg-blue-600">{submitting ? 'Saving...' : editing ? 'Update' : 'Record'}</Button></DialogFooter></form></DialogContent></Dialog></div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50 text-green-800 border-green-200"><AlertDescription>{success}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-lg">Total Earnings</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">KES {totalEarnings.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Total Expenses</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-600">KES {totalExpenses.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Net Profit</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">KES {totalProfit.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Trip Records</CardTitle><CardDescription>{trips.length} trips recorded</CardDescription></CardHeader><CardContent>{loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div> : trips.length === 0 ? <div className="text-center py-8 text-gray-500"><p>No trips recorded yet</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Driver</TableHead><TableHead>Distance</TableHead><TableHead>Earnings</TableHead><TableHead>Expenses</TableHead><TableHead>Profit</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{trips.map((trip) => (<TableRow key={trip.id}><TableCell>{format(new Date(trip.trip_date), 'MMM dd, yyyy')}</TableCell><TableCell>{trip.vehicles?.registration_number}</TableCell><TableCell>{trip.drivers?.full_name}</TableCell><TableCell>{trip.distance_km?.toFixed(1) || 0} km</TableCell><TableCell className="font-bold text-green-600">KES {(trip.earnings || 0).toLocaleString()}</TableCell><TableCell className="font-bold text-red-600">KES {(trip.expenses || 0).toLocaleString()}</TableCell><TableCell className="font-bold text-blue-600">KES {((trip.earnings || 0) - (trip.expenses || 0)).toLocaleString()}</TableCell><TableCell><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => handleOpenDialog(trip)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDelete(trip.id)}><Trash className="h-4 w-4 text-red-600" /></Button></div></TableCell></TableRow>))}</TableBody></Table></div>}</CardContent></Card>
    </div>
  );
}
