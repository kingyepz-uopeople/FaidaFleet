"use client";

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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2, Trash, Edit } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ vehicleReg: '', type: 'Fuel', amount: '', date: '', description: '' });

  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
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
        const tenantId: any = membership.tenant_id;

        const { data, error: fetchError } = await supabase
          .from('expenses')
          .select('*, vehicles(registration_number)')
          .eq('tenant_id', tenantId)
          .order('date', { ascending: false });
        if (fetchError) throw fetchError;
        setExpenses(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchExpenses();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openForEdit = (expense: any) => {
    setEditing(expense);
    setForm({
      vehicleReg: expense.vehicles?.registration_number || '',
      type: expense.category || expense.type || 'Other',
      amount: String(expense.amount || ''),
      date: expense.date ? expense.date.split('T')[0] : '',
      description: expense.description || '',
    });
    setOpen(true);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ vehicleReg: '', type: 'Fuel', amount: '', date: '', description: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
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
      const tenantId: any = membership.tenant_id;

      // lookup vehicle id by registration
      const vehiclesResp = await supabase
        .from('vehicles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('registration_number', form.vehicleReg)
        .limit(1)
        .single();
      const vehiclesData: any = vehiclesResp.data;
      const vErr = vehiclesResp.error;
      if (vErr) throw vErr;
      if (!vehiclesData) throw new Error('Vehicle not found. Please add vehicle first.');

      const payload: any = {
        tenant_id: tenantId,
        vehicle_id: vehiclesData.id,
        category: form.type.toLowerCase(),
        amount: Number(form.amount),
        date: form.date || new Date().toISOString().slice(0, 10),
        description: form.description || null,
      };

      if (editing) {
  const { error: updateError } = await supabase.from('expenses').update(payload).eq('id', editing.id);
  if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('expenses').insert(payload);
        if (insertError) throw insertError;
      }

      // Refresh
      const { data, error: fetchError } = await supabase
        .from('expenses')
        .select('*, vehicles(registration_number)')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false });
      if (fetchError) throw fetchError;
      setExpenses(data || []);
      setOpen(false);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    setError(null);
    try {
      const supabase = createClient();
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
      const tenantId: any = membership.tenant_id;

      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('tenant_id', tenantId);
      if (error) throw error;

      setExpenses(prev => prev.filter(x => x.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="vehicleReg">Vehicle Reg.</Label>
                <Input id="vehicleReg" name="vehicleReg" value={form.vehicleReg} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <select id="type" name="type" value={form.type} onChange={handleInputChange} className="w-full border rounded px-2 py-2">
                  <option>Fuel</option>
                  <option>Maintenance</option>
                  <option>Fine</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="amount">Amount (KES)</Label>
                <Input id="amount" name="amount" type="number" value={form.amount} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" value={form.date} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <textarea id="description" name="description" value={form.description} onChange={handleInputChange as any} className="w-full border rounded px-2 py-2" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? 'Save Changes' : 'Add Expense'}
              </Button>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Expense Log</CardTitle>
          <CardDescription>A list of all recorded expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : error ? (
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle Reg.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount (KES)</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.vehicles?.registration_number || '—'}</TableCell>
                    <TableCell>{(expense.category || expense.type || '').toString()}</TableCell>
                    <TableCell>{Number(expense.amount).toLocaleString()}</TableCell>
                    <TableCell>{format(new Date(expense.date), 'PP')}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openForEdit(expense)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)}>
                          <Trash className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
