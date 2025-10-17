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
import { PlusCircle } from 'lucide-react';
import { expenses } from '@/lib/data';
import { format } from 'date-fns';

export default function ExpensesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Expense Log</CardTitle>
          <CardDescription>A list of all recorded expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle Reg.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount (KES)</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.vehicleReg}</TableCell>
                  <TableCell>{expense.type}</TableCell>
                  <TableCell>{expense.amount.toLocaleString()}</TableCell>
                  <TableCell>{format(new Date(expense.timestamp), 'PPp')}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
