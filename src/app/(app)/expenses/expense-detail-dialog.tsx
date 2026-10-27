'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FormDialog } from '@/components/form-dialog';
import { formatDateOnly } from '@/lib/dates';
import { createClient } from '@/lib/supabase/client';
import type { Expense } from './expense-types';

const PHOTO_BUCKET = 'fuel-pump-photos';
const SIGNED_PHOTO_SECONDS = 120;

export default function ExpenseDetailDialog({ detailExpense, canViewPumpPhotos, onClose }: {
  detailExpense: Expense;
  canViewPumpPhotos: boolean;
  onClose: () => void;
}) {
  const [detailPhotoUrl, setDetailPhotoUrl] = useState<string | null>(null);
  const [detailPhotoLoading, setDetailPhotoLoading] = useState(false);
  const [detailPhotoError, setDetailPhotoError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    let active = true;
    setDetailPhotoUrl(null);
    setDetailPhotoError(null);
    if (!detailExpense || !canViewPumpPhotos) return;

    const expired = Boolean(detailExpense.pump_photo_deleted_at) || Boolean(
      detailExpense.pump_photo_expires_at &&
      new Date(detailExpense.pump_photo_expires_at).getTime() <= Date.now()
    );
    if (!detailExpense.pump_photo_path || expired) return;

    setDetailPhotoLoading(true);
    supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(detailExpense.pump_photo_path, SIGNED_PHOTO_SECONDS)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setDetailPhotoError(error.message);
        else setDetailPhotoUrl(data.signedUrl);
      })
      .catch((error: unknown) => {
        if (active) setDetailPhotoError(error instanceof Error ? error.message : 'Could not load the photo');
      })
      .finally(() => {
        if (active) setDetailPhotoLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canViewPumpPhotos, detailExpense, supabase]);

  const detailPhotoExpired = Boolean(detailExpense?.pump_photo_deleted_at) || Boolean(
    detailExpense?.pump_photo_expires_at &&
    new Date(detailExpense.pump_photo_expires_at).getTime() <= Date.now()
  );
  return (
      <FormDialog
        open={true}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title="Fuel record details"
        description="Pump photos use a private, two-minute signed link. The fuel record remains after the photo expires."
      >
        {detailExpense && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Date</dt><dd className="mt-1 font-medium">{formatDateOnly(detailExpense.date)}</dd></div>
              <div><dt className="text-muted-foreground">Vehicle</dt><dd className="mt-1 font-medium">{detailExpense.vehicles?.registration_number || '—'}</dd></div>
              <div><dt className="text-muted-foreground">Litres</dt><dd className="mt-1 font-medium">{detailExpense.litres ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">Price / litre</dt><dd className="mt-1 font-medium">{detailExpense.price_per_litre === null ? '—' : `KES ${detailExpense.price_per_litre}`}</dd></div>
              <div><dt className="text-muted-foreground">Odometer</dt><dd className="mt-1 font-medium">{detailExpense.odometer_km === null ? '—' : `${detailExpense.odometer_km} km`}</dd></div>
              <div><dt className="text-muted-foreground">Total</dt><dd className="mt-1 font-medium">KES {detailExpense.amount.toLocaleString()}</dd></div>
            </dl>
            <div className="space-y-2">
              <h3 className="font-medium">Pump photo</h3>
              {detailPhotoExpired ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Photo expired</p>
              ) : !detailExpense.pump_photo_path ? (
                <p className="text-sm text-muted-foreground">No pump photo was recorded for this fuel entry.</p>
              ) : detailPhotoLoading ? (
                <Skeleton className="h-64 w-full" aria-label="Loading pump photo" />
              ) : detailPhotoError ? (
                <Alert variant="destructive"><AlertDescription>Photo unavailable: {detailPhotoError}</AlertDescription></Alert>
              ) : detailPhotoUrl ? (
                <>
                  <a href={detailPhotoUrl} target="_blank" rel="noreferrer" className="block">
                    {/* Signed blob URLs are short-lived and must not be optimized/cached by next/image. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={detailPhotoUrl} alt="Fuel pump for this expense" className="max-h-96 w-full rounded-lg border object-contain" />
                  </a>
                  <Button type="button" variant="outline" className="min-h-11 w-full" asChild>
                    <a href={detailPhotoUrl} target="_blank" rel="noreferrer">Open full-size photo</a>
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </FormDialog>
  );
}
