"use client";

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { reconcileTransactionAction } from '@/app/actions';
import type { Collection } from '@/lib/types';
import { WandSparkles } from 'lucide-react';
import { drivers } from '@/lib/data';

interface ReconciliationButtonProps {
  transaction: Collection;
}

export function ReconciliationButton({ transaction }: ReconciliationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleReconcile = () => {
    startTransition(async () => {
      // Find the driver's phone number based on the vehicle registration
      // This is a simplified lookup for the MVP
      const driver = drivers.find(d => d.id === (
        { "KDA 123A": "1", "KDB 456B": "2", "KDD 012D": "4" } as Record<string, string>
      )[transaction.vehicleReg]);

      if (!driver) {
         toast({
          variant: 'destructive',
          title: 'Reconciliation Failed',
          description: 'Could not find a driver for this vehicle.',
        });
        return;
      }

      const result = await reconcileTransactionAction({
        amount: transaction.amount,
        msisdn: driver.phone,
        timestamp: transaction.timestamp,
        vehicleCode: transaction.transactionCode || '',
        tenantId: 'tenant-123'
      });

      if (result.success) {
        toast({
          title: 'Reconciliation Successful',
          description: result.message,
        });
        // Here you would typically re-fetch data or update the UI state
      } else {
        toast({
          variant: 'destructive',
          title: 'Reconciliation Failed',
          description: result.message,
        });
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReconcile}
      disabled={isPending}
    >
      {isPending ? (
        'Reconciling...'
      ) : (
        <>
          <WandSparkles className="mr-2 h-4 w-4" />
          AI Reconcile
        </>
      )}
    </Button>
  );
}
