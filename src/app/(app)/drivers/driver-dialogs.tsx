'use client';

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from '@/components/icons';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import type { AssignDriverForm, Driver, DriverForm, EditDriverForm, Vehicle } from './driver-types';

export function CreateDriverDialog({ formData, setFormData, setDialogOpen, submitting, formError, handleAddDriver }: {
  formData: DriverForm;
  setFormData: React.Dispatch<React.SetStateAction<DriverForm>>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  submitting: boolean;
  formError: string | null;
  handleAddDriver: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
      <FormDialog
        open={true}
        onOpenChange={setDialogOpen}
        title="Add driver"
        description="The driver signs in with this phone number and PIN. The PIN is stored as a hash, never in plain text."
      >
        <form onSubmit={handleAddDriver} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name *</Label>
            <Input
              id="full_name"
              placeholder="John Doe"
              autoComplete="name"
              value={formData.full_name}
              onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number *</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712345678"
              value={formData.phone}
              onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
              required
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN *</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                placeholder="4 to 6 digits"
                value={formData.pin}
                onChange={(event) => setFormData({ ...formData, pin: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin_confirm">Confirm PIN *</Label>
              <Input
                id="pin_confirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                placeholder="Repeat PIN"
                value={formData.pin_confirm}
                onChange={(event) => setFormData({ ...formData, pin_confirm: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="license_number">Licence number</Label>
            <Input
              id="license_number"
              placeholder="DL123456"
              value={formData.license_number}
              onChange={(event) => setFormData({ ...formData, license_number: event.target.value })}
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="license_expiry">Licence expiry</Label>
              <Input
                id="license_expiry"
                type="date"
                value={formData.license_expiry}
                onChange={(event) => setFormData({ ...formData, license_expiry: event.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id_number">ID number</Label>
              <Input
                id="id_number"
                inputMode="numeric"
                placeholder="12345678"
                value={formData.id_number}
                onChange={(event) => setFormData({ ...formData, id_number: event.target.value })}
                disabled={submitting}
              />
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
                  Adding…
                </>
              ) : (
                'Add driver'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>
  );
}

export function EditDriverDialog({ editingDriver, setEditingDriver, editFormData, setEditFormData, submitting, editError, handleEditDriver }: {
  editingDriver: Driver;
  setEditingDriver: React.Dispatch<React.SetStateAction<Driver | null>>;
  editFormData: EditDriverForm;
  setEditFormData: React.Dispatch<React.SetStateAction<EditDriverForm>>;
  submitting: boolean;
  editError: string | null;
  handleEditDriver: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
      <FormDialog
        open={true}
        onOpenChange={(open) => {
          if (!open && !submitting) setEditingDriver(null);
        }}
        title="Edit driver"
        description="Update the driver's name and licence details. Phone sign-in details stay unchanged."
      >
        <form onSubmit={handleEditDriver} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit_driver_name">Full name *</Label>
            <Input
              id="edit_driver_name"
              autoComplete="name"
              value={editFormData.full_name}
              onChange={(event) => setEditFormData({ ...editFormData, full_name: event.target.value })}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_driver_phone">Phone number</Label>
            <Input
              id="edit_driver_phone"
              type="tel"
              value={editingDriver?.phone || ''}
              readOnly
              disabled
              aria-describedby="edit_driver_phone_hint"
            />
            <p id="edit_driver_phone_hint" className="text-sm text-muted-foreground">
              Read-only because this normalized phone number is linked to the driver&apos;s phone-auth email. Ask a system administrator about identity changes.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_license_number">Licence number</Label>
            <Input
              id="edit_license_number"
              placeholder="DL123456"
              value={editFormData.license_number}
              onChange={(event) => setEditFormData({ ...editFormData, license_number: event.target.value })}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_license_expiry">Licence expiry</Label>
            <Input
              id="edit_license_expiry"
              type="date"
              value={editFormData.license_expiry}
              onChange={(event) => setEditFormData({ ...editFormData, license_expiry: event.target.value })}
              disabled={submitting}
            />
          </div>
          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditingDriver(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save driver'}
            </Button>
          </div>
        </form>
      </FormDialog>
  );
}

export function AssignDriverDialog({ assignFormData, setAssignFormData, setAssignDialogOpen, drivers, vehicles, submitting, assignError, handleAssignDriver }: {
  assignFormData: AssignDriverForm;
  setAssignFormData: React.Dispatch<React.SetStateAction<AssignDriverForm>>;
  setAssignDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  drivers: Driver[];
  vehicles: Vehicle[];
  submitting: boolean;
  assignError: string | null;
  handleAssignDriver: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
      <FormDialog
        open={true}
        onOpenChange={setAssignDialogOpen}
        title="Assign driver to vehicle"
        description="The previous driver of this vehicle is marked as ended on the start date."
      >
        <form onSubmit={handleAssignDriver} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver_select">Driver *</Label>
            <NativeSelect
              id="driver_select"
              value={assignFormData.driver_id}
              onChange={(event) => setAssignFormData({ ...assignFormData, driver_id: event.target.value })}
              required
              disabled={submitting}
            >
              <option value="">Select driver</option>
              {drivers.filter((driver) => driver.is_active).map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle_select">Vehicle *</Label>
            <NativeSelect
              id="vehicle_select"
              value={assignFormData.vehicle_id}
              onChange={(event) => setAssignFormData({ ...assignFormData, vehicle_id: event.target.value })}
              required
              disabled={submitting}
            >
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration_number}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">Start date *</Label>
            <Input
              id="start_date"
              type="date"
              value={assignFormData.start_date}
              onChange={(event) => setAssignFormData({ ...assignFormData, start_date: event.target.value })}
              required
              disabled={submitting}
            />
          </div>

          {assignError && (
            <Alert variant="destructive">
              <AlertDescription>{assignError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setAssignDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning…
                </>
              ) : (
                'Assign driver'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>
  );
}
