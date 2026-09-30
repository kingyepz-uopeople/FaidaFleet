'use server';

/**
 * @fileOverview This file defines a Genkit flow for automated M-Pesa transaction reconciliation.
 *
 * It takes transaction details and attempts to match them against existing records.
 * - reconcileMpesaTransaction - A function that triggers the M-Pesa reconciliation flow.
 * - ReconcileMpesaTransactionInput - The input type for the reconcileMpesaTransaction function.
 * - ReconcileMpesaTransactionOutput - The return type for the reconcileMpesaTransaction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReconcileMpesaTransactionInputSchema = z.object({
  amount: z.number().describe('The amount of the M-Pesa transaction.'),
  msisdn: z.string().describe('The MSISDN (mobile number) of the transaction sender.'),
  vehicleCode: z.string().optional().describe('The vehicle code associated with the transaction, if available.'),
  timestamp: z.string().describe('The timestamp of the M-Pesa transaction.'),
  tenantId: z.string().describe('The ID of the tenant to reconcile the transaction for.'),
});
export type ReconcileMpesaTransactionInput = z.infer<typeof ReconcileMpesaTransactionInputSchema>;

const ReconcileMpesaTransactionOutputSchema = z.object({
  reconciliationStatus: z.string().describe('The status of the reconciliation attempt (matched, not_matched, error).'),
  collectionId: z.string().optional().describe('The ID of the matched collection, if found.'),
  notes: z.string().optional().describe('Additional notes about the reconciliation process.'),
});
export type ReconcileMpesaTransactionOutput = z.infer<typeof ReconcileMpesaTransactionOutputSchema>;

export async function reconcileMpesaTransaction(input: ReconcileMpesaTransactionInput): Promise<ReconcileMpesaTransactionOutput> {
  return reconcileMpesaTransactionFlow(input);
}

const reconcileMpesaTransactionPrompt = ai.definePrompt({
  name: 'reconcileMpesaTransactionPrompt',
  input: {schema: ReconcileMpesaTransactionInputSchema},
  output: {schema: ReconcileMpesaTransactionOutputSchema},
  prompt: `You are an expert financial reconciliation assistant specializing in matching M-Pesa transactions to collections records.

  Given the following M-Pesa transaction details, search for a matching collection record within the system.

  Amount: {{{amount}}}
  MSISDN: {{{msisdn}}}
  Vehicle Code: {{{vehicleCode}}}
  Timestamp: {{{timestamp}}}

  Consider the amount, MSISDN, vehicle code (if available), and timestamp to find the best match.

  Return a JSON object indicating the reconciliation status. If a match is found, include the collection ID and set the status to 'matched'.
  If no match is found, set the status to 'not_matched'. If an error occurs during the process, set the status to 'error' and provide details in the notes.

  {
    "reconciliationStatus": "matched" | "not_matched" | "error",
    "collectionId": "collection_id" | null,
    "notes": "Any relevant notes" | null
  }`,
});

const reconcileMpesaTransactionFlow = ai.defineFlow(
  {
    name: 'reconcileMpesaTransactionFlow',
    inputSchema: ReconcileMpesaTransactionInputSchema,
    outputSchema: ReconcileMpesaTransactionOutputSchema,
  },
  async input => {
    try {
      const {output} = await reconcileMpesaTransactionPrompt(input);
      return output!;
    } catch (error: any) {
      console.error('Error during M-Pesa reconciliation:', error);
      return {
        reconciliationStatus: 'error',
        notes: `An error occurred during reconciliation: ${error.message || 'Unknown error'}`,
      };
    }
  }
);
