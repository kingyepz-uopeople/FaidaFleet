'use client';

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from '@/components/icons';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { LockedValue } from '@/components/driver-scope';
import type { Collection, CollectionForm, Option, PaymentMethod, Shift } from './collection-types';

type Props = {
  editing: Collection | null;
  form: CollectionForm;
  setForm: React.Dispatch<React.SetStateAction<CollectionForm>>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDriver: boolean;
  vehicleLabel: string | null;
  driverName: string | null;
  vehicles: Option[];
  drivers: Option[];
  submitting: boolean;
  formError: string | null;
  handleSubmit: React.FormEventHandler<HTMLFormElement>;
};

export default function CollectionFormDialog({
  editing, form, setForm, setDialogOpen, isDriver, vehicleLabel, driverName, vehicles, drivers, submitting, formError, handleSubmit,
}: Props) {
  return (
    <FormDialog
      open={true}
      onOpenChange={setDialogOpen}
      title={editing ? 'Edit collection' : 'Record collection'}
      description={isDriver ? 'Your name and current vehicle are filled in for you.' : 'Collections are the revenue side of your fleet P&L.'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isDriver ? (
          <>
            <LockedValue id="collection_vehicle_locked" label="Vehicle" value={vehicleLabel || 'No vehicle assigned'} hint="Set by your fleet owner." />
            <LockedValue id="collection_driver_locked" label="Driver" value={driverName || 'Your driver record'} hint="You can only record your own collections." />
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="collection_vehicle">Vehicle *</Label>
              <NativeSelect
                id="collection_vehicle"
                value={form.vehicleId}
                onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}
                required
                disabled={submitting}
              >
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collection_driver">Driver *</Label>
              <NativeSelect
                id="collection_driver"
                value={form.driverId}
                onChange={(event) => setForm({ ...form, driverId: event.target.value })}
                required
                disabled={submitting}
              >
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.label}</option>
                ))}
              </NativeSelect>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="collection_amount">Amount (KES) *</Label>
          <Input
            id="collection_amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            placeholder="0.00"
            required
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="collection_method">Payment method *</Label>
          <NativeSelect
            id="collection_method"
            value={form.paymentMethod}
            onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}
            required
            disabled={submitting}
          >
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="pochi">Pochi</option>
          </NativeSelect>
        </div>

        {form.paymentMethod === 'mpesa' && (
          <div className="space-y-2">
            <Label htmlFor="mpesa_receipt">M-Pesa receipt / transaction code</Label>
            <Input
              id="mpesa_receipt"
              value={form.mpesaReceipt}
              onChange={(event) => setForm({ ...form, mpesaReceipt: event.target.value })}
              placeholder="e.g., ABCDEF123456"
              disabled={submitting}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="collection_date">Date *</Label>
            <Input
              id="collection_date"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection_shift">Shift *</Label>
            <NativeSelect
              id="collection_shift"
              value={form.shift}
              onChange={(event) => setForm({ ...form, shift: event.target.value as Shift })}
              required
              disabled={submitting}
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </NativeSelect>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="collection_notes">Notes (optional)</Label>
          <Textarea
            id="collection_notes"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Anything worth noting about this collection…"
            rows={3}
            disabled={submitting}
          />
        </div>

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" className="min-h-11" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : editing ? (
              'Update collection'
            ) : (
              'Record collection'
            )}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
