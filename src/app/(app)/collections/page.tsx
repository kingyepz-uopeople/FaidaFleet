import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle } from 'lucide-react';
import { collections } from '@/lib/data';
import { ReconciliationButton } from './reconciliation-client';
import { format } from 'date-fns';

export default function CollectionsPage() {
  const getStatusBadgeVariant = (reconciled: boolean) => {
    return reconciled
      ? 'bg-green-100 text-green-800 hover:bg-green-200'
      : 'bg-amber-100 text-amber-800 hover:bg-amber-200';
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Collections</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Collection
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Transaction Log</CardTitle>
          <CardDescription>A list of all recorded collections.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle Reg.</TableHead>
                <TableHead>Amount (KES)</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell className="font-medium">{collection.vehicleReg}</TableCell>
                  <TableCell>{collection.amount.toLocaleString()}</TableCell>
                  <TableCell>{collection.paymentMethod}</TableCell>
                  <TableCell>{format(new Date(collection.timestamp), 'PPp')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusBadgeVariant(collection.reconciled)}>
                      {collection.reconciled ? 'Reconciled' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {collection.paymentMethod === 'M-Pesa' && !collection.reconciled && (
                      <ReconciliationButton transaction={collection} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
