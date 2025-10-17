'use client';

import React from 'react';
import {
  TrendingUp,
  Wallet,
  Receipt,
  Truck,
  Users,
  BadgeCheck,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { collections } from '@/lib/data';

const chartData = [
  { date: 'Mon', collections: 4000, expenses: 2400 },
  { date: 'Tue', collections: 3000, expenses: 1398 },
  { date: 'Wed', collections: 2000, expenses: 9800 },
  { date: 'Thu', collections: 2780, expenses: 3908 },
  { date: 'Fri', collections: 1890, expenses: 4800 },
  { date: 'Sat', collections: 2390, expenses: 3800 },
  { date: 'Sun', collections: 3490, expenses: 4300 },
];

const chartConfig = {
  collections: {
    label: "Collections",
    color: "hsl(var(--primary))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--destructive))",
  },
};

export default function DashboardPage() {
  const recentTransactions = collections.slice(0, 5);
  
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Collections"
          value="KES 12,800"
          description="+20.1% from last month"
          Icon={Wallet}
        />
        <StatCard
          title="Total Expenses"
          value="KES 8,000"
          description="+18.1% from last month"
          Icon={Receipt}
        />
        <StatCard
          title="Net Profit"
          value="KES 4,800"
          description="+25.3% from last month"
          Icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
         <Card>
            <CardHeader>
              <CardTitle>Fleet Status</CardTitle>
              <CardDescription>Overview of your vehicle fleet.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-4 rounded-lg border p-4">
                 <Truck className="h-8 w-8 text-primary" />
                 <div>
                    <p className="text-sm text-muted-foreground">Total Vehicles</p>
                    <p className="text-2xl font-bold">4</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg border p-4">
                 <Users className="h-8 w-8 text-primary" />
                 <div>
                    <p className="text-sm text-muted-foreground">Active Drivers</p>
                    <p className="text-2xl font-bold">3</p>
                 </div>
              </div>
            </CardContent>
          </Card>
          <Card>
             <CardHeader>
              <CardTitle>Reconciliation Status</CardTitle>
              <CardDescription>M-Pesa transaction reconciliation.</CardDescription>
            </CardHeader>
             <CardContent className="flex items-center gap-4 rounded-lg border p-4">
               <BadgeCheck className="h-8 w-8 text-green-500" />
               <div>
                  <p className="text-sm text-muted-foreground">Reconciled / Pending</p>
                  <p className="text-2xl font-bold">
                    <span className="text-green-500">2</span> / <span className="text-amber-500">2</span>
                  </p>
               </div>
            </CardContent>
          </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Weekly Overview</CardTitle>
            <CardDescription>Collections vs Expenses for the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
             <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={70} tickFormatter={(value) => `KES ${value/1000}k`}/>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="collections" fill="var(--color-collections)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
             <CardDescription>The last 5 recorded collections.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <div className="font-medium">{tx.vehicleReg}</div>
                      <div className="text-sm text-muted-foreground">{tx.paymentMethod}</div>
                    </TableCell>
                    <TableCell>KES {tx.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={tx.reconciled ? 'default' : 'secondary'}
                        className={tx.reconciled ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                      >
                        {tx.reconciled ? 'Reconciled' : 'Pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
