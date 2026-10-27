'use client';

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from '@/components/icons';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { LockedValue } from '@/components/driver-scope';
import type { Option, Trip, TripForm } from './trip-types';

type Props = {
  editing: Trip | null;
  form: TripForm;
  setForm: React.Dispatch<React.SetStateAction<TripForm>>;
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

export default function TripFormDialog({
  editing, form, setForm, setDialogOpen, isDriver, vehicleLabel, driverName,
  vehicles, drivers, submitting, formError, handleSubmit,
}: Props) {
  return (
      <FormDialog
        open={true}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit trip' : 'Record trip'}
        description={isDriver ? 'Your name and current vehicle are filled in for you.' : 'Trips feed the dashboard profit figures and driver analytics.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isDriver ? (
            <>
              <LockedValue id="trip_vehicle_locked" label="Vehicle" value={vehicleLabel || 'No vehicle assigned'} hint="Set by your fleet owner." />
              <LockedValue id="trip_driver_locked" label="Driver" value={driverName || 'Your driver record'} hint="You can only record your own trips." />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="trip_vehicle">Vehicle *</Label>
                <NativeSelect
                  id="trip_vehicle"
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
                <Label htmlFor="trip_driver">Driver *</Label>
                <NativeSelect
                  id="trip_driver"
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
            <Label htmlFor="trip_date">Trip date *</Label>
            <Input
              id="trip_date"
              type="date"
              className="h-12 text-base"
              value={form.tripDate}
              onChange={(event) => setForm({ ...form, tripDate: event.target.value })}
              required
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="distance">Distance (km)</Label>
              <Input
                id="distance"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="h-12 text-base"
                value={form.distanceKm}
                onChange={(event) => setForm({ ...form, distanceKm: event.target.value })}
                placeholder="0.00"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="earnings">Earnings (KES) *</Label>
              <Input
                id="earnings"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="h-12 text-base"
                value={form.earnings}
                onChange={(event) => setForm({ ...form, earnings: event.target.value })}
                placeholder="0.00"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expenses">Expenses (KES)</Label>
              <Input
                id="expenses"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="h-12 text-base"
                value={form.expenses}
                onChange={(event) => setForm({ ...form, expenses: event.target.value })}
                placeholder="0.00"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_location">From</Label>
              <Input
                id="start_location"
                value={form.startLocation}
                onChange={(event) => setForm({ ...form, startLocation: event.target.value })}
                placeholder="e.g., CBD"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_location">To</Label>
              <Input
                id="end_location"
                value={form.endLocation}
                onChange={(event) => setForm({ ...form, endLocation: event.target.value })}
                placeholder="e.g., Westlands"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip_notes">Notes (optional)</Label>
            <Textarea
              id="trip_notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Anything worth noting about this trip…"
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
                'Update trip'
              ) : (
                'Record trip'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>
  );
}
