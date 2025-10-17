"use server";

import { reconcileMpesaTransaction, type ReconcileMpesaTransactionInput } from "@/ai/flows/mpesa-reconciliation";

export async function reconcileTransactionAction(input: ReconcileMpesaTransactionInput) {
  try {
    // In a real app, you'd find a matching collection record here before calling the AI.
    // For this MVP, we simulate passing the transaction directly to the AI flow.
    
    // Simulate some vehicle code and tenant ID for the AI flow
    const enrichedInput: ReconcileMpesaTransactionInput = {
      ...input,
      vehicleCode: input.vehicleCode || 'KV-01',
      tenantId: 'tenant-123',
    };

    const result = await reconcileMpesaTransaction(enrichedInput);

    if (result.reconciliationStatus === 'matched') {
      // Here you would update your database:
      // await db.update('collections').set({ reconciled: true }).where('id', result.collectionId);
      return { success: true, message: `Matched with collection ID: ${result.collectionId || 'N/A'}.` };
    } else if(result.reconciliationStatus === 'not_matched') {
      return { success: false, message: 'No matching collection found.' };
    } else {
       return { success: false, message: `Reconciliation error: ${result.notes || 'Unknown error'}` };
    }
  } catch (error) {
    console.error("Reconciliation action failed:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
}
