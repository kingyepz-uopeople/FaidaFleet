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

type Maintenance = { id: string; vehicle_id: string; date: string; type: string; description: string; cost: number; next_service_date: string; vehicles: { registration_number: string } };

export default function MaintenancePage() {
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({ vehicleId: '', type: 'service', description: '', cost: '', date: new Date().toISOString().split('T')[0], nextServiceDate: '' });
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

      const [maintenanceRes, vehiclesRes] = await Promise.all([
        supabase.from('maintenance_logs').select('*, vehicles(registration_number)').eq('tenant_id', tId).order('date', { ascending: false }),
        supabase.from('vehicles').select('id, registration_number').eq('tenant_id', tId).eq('is_active', true),
      ]);

      if (maintenanceRes.error) throw maintenanceRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setMaintenance(maintenanceRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (m?: Maintenance) => {
    if (m) {
      setEditing(m);
      setForm({ vehicleId: m.vehicle_id, type: m.type, description: m.description || '', cost: m.cost?.toString() || '', date: m.date, nextServiceDate: m.next_service_date || '' });
    } else {
      setEditing(null);
      setForm({ vehicleId: '', type: 'service', description: '', cost: '', date: new Date().toISOString().split('T')[0], nextServiceDate: '' });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!tenantId) throw new Error('No tenant found');
      const payload: any = { tenant_id: tenantId, vehicle_id: form.vehicleId, type: form.type, description: form.description, cost: parseFloat(form.cost) || 0, date: form.date, next_service_date: form.nextServiceDate || null };
      if (editing) {
        const { error: err } = await supabase.from('maintenance_logs').update(payload).eq('id', editing.id);
        if (err) throw err;
        setSuccess('Maintenance record updated');
      } else {
        const { error: err } = await supabase.from('maintenance_logs').insert([payload]);
        if (err) throw err;
        setSuccess('Maintenance recorded successfully');
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
    if (!window.confirm('Delete this maintenance record?')) return;
    try {
      const { error: err } = await supabase.from('maintenance_logs').delete().eq('id', id);
      if (err) throw err;
      setSuccess('Maintenance record deleted');
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalCost = maintenance.reduce((sum, m) => sum + (m.cost || 0), 0);
  const upcomingServices = maintenance.filter(m => m.next_service_date && new Date(m.next_service_date) > new Date()).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Maintenance Scheduler</h1><p className="text-gray-600 dark:text-gray-400">Track vehicle maintenance and repairs</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700"><PlusCircle className="mr-2 h-4 w-4" />Record Maintenance</Button></DialogTrigger><DialogContent className="max-w-md max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? 'Edit Maintenance' : 'Record Maintenance'}</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="space-y-4"><div><Label>Vehicle *</Label><Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>))}</SelectContent></Select></div><div><Label>Type *</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="service">Service</SelectItem><SelectItem value="repair">Repair</SelectItem><SelectItem value="inspection">Inspection</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div><Label>Description *</Label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was done?" className="w-full border rounded px-2 py-2" rows={3} required /></div><div><Label>Cost (KES)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" /></div><div><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div><div><Label>Next Service Date</Label><Input type="date" value={form.nextServiceDate} onChange={(e) => setForm({ ...form, nextServiceDate: e.target.value })} /></div>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting} className="bg-blue-600">{submitting ? 'Saving...' : editing ? 'Update' : 'Record'}</Button></DialogFooter></form></DialogContent></Dialog></div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50 text-green-800 border-green-200"><AlertDescription>{success}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-lg">Total Maintenance Cost</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">KES {totalCost.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Records</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-purple-600">{maintenance.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Upcoming Services</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-orange-600">{upcomingServices}</p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Maintenance Records</CardTitle><CardDescription>{maintenance.length} records found</CardDescription></CardHeader><CardContent>{loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div> : maintenance.length === 0 ? <div className="text-center py-8 text-gray-500"><p>No maintenance records yet</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Cost</TableHead><TableHead>Next Service</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{maintenance.map((m) => (<TableRow key={m.id}><TableCell>{format(new Date(m.date), 'MMM dd, yyyy')}</TableCell><TableCell className="font-bold">{m.vehicles?.registration_number}</TableCell><TableCell><Badge>{m.type}</Badge></TableCell><TableCell>{m.description}</TableCell><TableCell className="font-bold">KES {(m.cost || 0).toLocaleString()}</TableCell><TableCell>{m.next_service_date ? format(new Date(m.next_service_date), 'MMM dd, yyyy') : '—'}</TableCell><TableCell><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => handleOpenDialog(m)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)}><Trash className="h-4 w-4 text-red-600" /></Button></div></TableCell></TableRow>))}</TableBody></Table></div>}</CardContent></Card>
    </div>
  );
}
