'use client';

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from '@/components/icons';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import type { Vehicle, VehicleForm } from './vehicle-types';

type Props = {
  editing: Vehicle | null;
  form: VehicleForm;
  setForm: React.Dispatch<React.SetStateAction<VehicleForm>>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  submitting: boolean;
  formError: string | null;
  handleSubmit: React.FormEventHandler<HTMLFormElement>;
};

export default function VehicleFormDialog({
  editing, form, setForm, setDialogOpen, submitting, formError, handleSubmit,
}: Props) {
  return (
    <FormDialog
      open={true}
      onOpenChange={setDialogOpen}
      title={editing ? 'Edit vehicle' : 'Add vehicle'}
      description={editing ? 'Update this vehicle and its compliance dates.' : 'Register a vehicle so you can record its trips and collections.'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="registration">Registration number *</Label>
          <Input
            id="registration"
            value={form.registration}
            onChange={(event) => setForm({ ...form, registration: event.target.value })}
            placeholder="e.g., KCA 123A"
            autoComplete="off"
            required
            disabled={submitting}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="make">Make</Label>
            <Input id="make" value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} placeholder="Toyota" disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input id="model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Hiace" disabled={submitting} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input id="year" type="number" inputMode="numeric" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input id="capacity" type="number" inputMode="numeric" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="14" disabled={submitting} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle_type">Vehicle type *</Label>
          <NativeSelect
            id="vehicle_type"
            value={form.vehicleType}
            onChange={(event) => setForm({ ...form, vehicleType: event.target.value as NonNullable<Vehicle['vehicle_type']> })}
            required
            disabled={submitting}
          >
            <option value="psv">PSV (public service)</option>
            <option value="cargo">Cargo</option>
            <option value="pickup">Pickup</option>
            <option value="other">Other</option>
          </NativeSelect>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="insurance">Insurance expiry</Label>
            <Input id="insurance" type="date" value={form.insuranceExpiry} onChange={(event) => setForm({ ...form, insuranceExpiry: event.target.value })} disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mot">MOT expiry</Label>
            <Input id="mot" type="date" value={form.motExpiry} onChange={(event) => setForm({ ...form, motExpiry: event.target.value })} disabled={submitting} />
          </div>
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
              'Update vehicle'
            ) : (
              'Add vehicle'
            )}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
