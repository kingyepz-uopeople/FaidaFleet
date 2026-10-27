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
import { CATEGORY_LABELS, type Expense, type ExpenseCategory, type ExpenseForm, type Option } from './expense-types';

type Props = {
  editing: Expense | null;
  form: ExpenseForm;
  setForm: React.Dispatch<React.SetStateAction<ExpenseForm>>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDriver: boolean;
  vehicleLabel: string | null;
  vehicles: Option[];
  formDisabled: boolean;
  submitting: boolean;
  photoPreparing: boolean;
  photoInputRef: React.RefObject<HTMLInputElement>;
  pumpPhoto: Blob | null;
  pumpPhotoPreview: string | null;
  formError: string | null;
  handleSubmit: React.FormEventHandler<HTMLFormElement>;
  handlePhotoSelected: React.ChangeEventHandler<HTMLInputElement>;
  updateFuelNumber: (field: 'litres' | 'pricePerLitre' | 'amount', value: string) => void;
};

export default function ExpenseFormDialog({
  editing, form, setForm, setDialogOpen, isDriver, vehicleLabel, vehicles,
  formDisabled, submitting, photoPreparing, photoInputRef, pumpPhoto,
  pumpPhotoPreview, formError, handleSubmit, handlePhotoSelected, updateFuelNumber,
}: Props) {
  return (
      <FormDialog
        open={true}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit expense' : form.category === 'fuel' ? 'Log fuel' : 'Add expense'}
        description={isDriver ? `Log ${form.category === 'fuel' ? 'fuel' : 'an expense'} for your assigned vehicle.` : 'Vehicle is optional for costs that are not tied to one vehicle.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isDriver ? (
            <LockedValue id="expense_vehicle_locked" label="Vehicle" value={vehicleLabel || 'No vehicle assigned'} hint="Fuel is always logged against your current vehicle." />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="expense_vehicle">Vehicle{form.category === 'fuel' ? ' *' : ''}</Label>
              <NativeSelect
                id="expense_vehicle"
                value={form.vehicleId}
                onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}
                disabled={formDisabled}
                required={form.category === 'fuel'}
              >
                <option value="">{form.category === 'fuel' ? 'Select vehicle' : 'General expense'}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expense_category">Type *</Label>
            <NativeSelect
              id="expense_category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value as ExpenseCategory })}
              required
              disabled={formDisabled}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </div>

          {form.category === 'fuel' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fuel_odometer">Odometer (km) *</Label>
                <Input
                  id="fuel_odometer"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="h-12 text-base"
                  value={form.odometerKm}
                  onChange={(event) => setForm({ ...form, odometerKm: event.target.value })}
                  placeholder="e.g. 125430"
                  required={!editing}
                  disabled={formDisabled}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fuel_litres">Litres *</Label>
                  <Input
                    id="fuel_litres"
                    type="number"
                    inputMode="decimal"
                    min="0.001"
                    step="0.001"
                    className="h-12 text-base"
                    value={form.litres}
                    onChange={(event) => updateFuelNumber('litres', event.target.value)}
                    placeholder="0.000"
                    required={!editing}
                    disabled={formDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuel_price">Price per litre (KES) *</Label>
                  <Input
                    id="fuel_price"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    className="h-12 text-base"
                    value={form.pricePerLitre}
                    onChange={(event) => updateFuelNumber('pricePerLitre', event.target.value)}
                    placeholder="0.00"
                    required={!editing}
                    disabled={formDisabled}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Litres and price calculate the total. Editing the total calculates the price per litre.</p>
            </>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense_amount">{form.category === 'fuel' ? 'Total (KES)' : 'Amount (KES)'} *</Label>
              <Input
                id="expense_amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(event) => updateFuelNumber('amount', event.target.value)}
                placeholder="0.00"
                required
                disabled={formDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense_date">Date *</Label>
              <Input
                id="expense_date"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                required
                disabled={formDisabled}
              />
            </div>
          </div>

          {form.category === 'fuel' && !editing && (
            <div className="space-y-2">
              <Label htmlFor="pump_photo">Pump photo{isDriver ? ' *' : ' (optional for owner)'}</Label>
              <input
                ref={photoInputRef}
                id="pump_photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handlePhotoSelected}
                disabled={formDisabled}
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => photoInputRef.current?.click()}
                disabled={formDisabled}
              >
                {photoPreparing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing photo…</> : pumpPhoto ? 'Retake photo of pump' : 'Take photo of pump'}
              </Button>
              <p className="text-sm text-muted-foreground">Compressed before upload (about 200 KB, maximum 1280 px). {isDriver ? 'A photo is required for driver fuel entries.' : 'Owners can save fuel without a photo.'}</p>
              {pumpPhotoPreview && pumpPhoto && (
                <div className="space-y-2">
                  {/* Blob previews cannot use next/image optimization. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pumpPhotoPreview} alt="Selected pump preview" className="max-h-64 w-full rounded-lg border object-contain" />
                  <p className="text-sm text-muted-foreground">Ready to upload · {Math.round(pumpPhoto.size / 1024)} KB</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expense_description">Description</Label>
            <textarea
              id="expense_description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Optional notes…"
              rows={3}
              disabled={formDisabled}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            />
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)} disabled={formDisabled}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={formDisabled}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                'Update expense'
              ) : form.category === 'fuel' ? (
                'Log fuel'
              ) : (
                'Add expense'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>
  );
}
