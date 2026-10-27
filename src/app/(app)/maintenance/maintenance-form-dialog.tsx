'use client';

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from '@/components/icons';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { LockedValue } from '@/components/driver-scope';
import { TYPE_LABELS, type Maintenance, type MaintenanceType, type MaintenanceForm, type Option } from './maintenance-types';

type Props = {
  editing: Maintenance | null;
  form: MaintenanceForm;
  setForm: React.Dispatch<React.SetStateAction<MaintenanceForm>>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDriver: boolean;
  vehicleLabel: string | null;
  vehicles: Option[];
  submitting: boolean;
  formError: string | null;
  handleSubmit: React.FormEventHandler<HTMLFormElement>;
};

export default function MaintenanceFormDialog({
  editing, form, setForm, setDialogOpen, isDriver, vehicleLabel, vehicles, submitting, formError, handleSubmit,
}: Props) {
  return (
    <FormDialog
      open={true}
      onOpenChange={setDialogOpen}
      title={editing ? 'Edit maintenance' : 'Record maintenance'}
      description={isDriver ? 'Your current vehicle is filled in for you.' : 'Maintenance costs are included in your fleet profit calculations.'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isDriver ? (
          <LockedValue id="maintenance_vehicle_locked" label="Vehicle" value={vehicleLabel || 'No vehicle assigned'} hint="Set by your fleet owner." />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="maintenance_vehicle">Vehicle *</Label>
            <NativeSelect
              id="maintenance_vehicle"
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
        )}

        <div className="space-y-2">
          <Label htmlFor="maintenance_type">Type *</Label>
          <NativeSelect
            id="maintenance_type"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as MaintenanceType })}
            required
            disabled={submitting}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maintenance_description">Description *</Label>
          <textarea
            id="maintenance_description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="What was done?"
            rows={3}
            required
            disabled={submitting}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maintenance_cost">Cost (KES)</Label>
            <Input
              id="maintenance_cost"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.cost}
              onChange={(event) => setForm({ ...form, cost: event.target.value })}
              placeholder="0.00"
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maintenance_date">Date *</Label>
            <Input
              id="maintenance_date"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
              disabled={submitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="next_service">Next service date</Label>
          <Input
            id="next_service"
            type="date"
            value={form.nextServiceDate}
            onChange={(event) => setForm({ ...form, nextServiceDate: event.target.value })}
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
              'Update record'
            ) : (
              'Record maintenance'
            )}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
