
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash, Edit } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { ReconciliationButton } from './reconciliation-client';
function CollectionsPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    vehicleId: '',
    driverId: '',
    amount: '',
    paymentMethod: 'cash',
    transactionCode: '',
    date: '',
    shift: 'morning',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        // Get tenant membership
        const membershipResp = await supabase
          .from('memberships')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();
        const membership: any = membershipResp.data;
        if (!membership) throw new Error('No tenant found');
        const tenantId: any = membership.tenant_id;
        // Fetch collections
        const { data, error: fetchError } = await supabase
          .from('collections')

          return (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Collections</h1>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Collection
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Collection</DialogTitle>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                      <div>
                        <Label htmlFor="vehicleId">Vehicle</Label>
                        <select id="vehicleId" name="vehicleId" value={form.vehicleId} onChange={handleInputChange} className="w-full border rounded px-2 py-2" required>
                          <option value="">Select vehicle</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>{v.registration_number}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="driverId">Driver</Label>
                        <select id="driverId" name="driverId" value={form.driverId} onChange={handleInputChange} className="w-full border rounded px-2 py-2" required>
                          <option value="">Select driver</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="amount">Amount (KES)</Label>
                        <Input id="amount" name="amount" type="number" value={form.amount} onChange={handleInputChange} required />
                      </div>
                      <div>
                        <Label htmlFor="paymentMethod">Payment Method</Label>
                        <select id="paymentMethod" name="paymentMethod" value={form.paymentMethod} onChange={handleInputChange} className="w-full border rounded px-2 py-2">
                          <option value="cash">Cash</option>
                          <option value="mpesa">M-Pesa</option>
                          <option value="pochi">Pochi</option>
                        </select>
                      </div>
                      {form.paymentMethod === 'mpesa' && (
                        <div>
                          <Label htmlFor="transactionCode">M-Pesa Receipt</Label>
                          <Input id="transactionCode" name="transactionCode" value={form.transactionCode} onChange={handleInputChange} />
                        </div>
                      )}
                      <div>
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" name="date" type="date" value={form.date} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="shift">Shift</Label>
                        <select id="shift" name="shift" value={form.shift} onChange={handleInputChange} className="w-full border rounded px-2 py-2">
                          <option value="morning">Morning</option>
                          <option value="afternoon">Afternoon</option>
                          <option value="evening">Evening</option>
                          <option value="night">Night</option>
                        </select>
                      </div>
                      <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {editing ? 'Update Collection' : 'Add Collection'}
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
                  <CardTitle>Transaction Log</CardTitle>
                  <CardDescription>A list of all recorded collections.</CardDescription>
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
                          <TableHead>Driver</TableHead>
                          <TableHead>Amount (KES)</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collections.map((collection) => (
                          <TableRow key={collection.id}>
                            <TableCell className="font-medium">{collection.vehicles?.registration_number}</TableCell>
                            <TableCell>{drivers.find(d => d.id === collection.driver_id)?.full_name || ''}</TableCell>
                            <TableCell>{collection.amount?.toLocaleString()}</TableCell>
                            <TableCell>{collection.payment_method?.toUpperCase()}</TableCell>
                            <TableCell>{format(new Date(collection.date), 'PP')}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusBadgeVariant(collection.reconciled)}>
                                {collection.reconciled ? 'Reconciled' : 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => openForEdit(collection)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => {/* TODO: handleDelete(collection.id) */}}><Trash className="h-4 w-4" /></Button>
                              {collection.payment_method === 'mpesa' && !collection.reconciled && (
                                <ReconciliationButton transaction={collection} />
                              )}
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
  }

export default CollectionsPage;
