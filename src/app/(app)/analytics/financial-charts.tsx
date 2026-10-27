'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { profitBreakdown, type groupFinancials } from '@/lib/fleet-metrics';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function FinancialCharts({ report }: { report: ReturnType<typeof groupFinancials> | null }) {
  if (!report) {
    return (
      <Card>
        <CardHeader><CardTitle>Revenue vs Expenses Trend</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" aria-label="Loading financial charts" /></CardContent>
      </Card>
    );
  }
  const slices = profitBreakdown(report.totalProfit, report.totalExpenses);
  return (
    <>
      <Card>
        <CardHeader><CardTitle>Revenue vs Expenses Trend</CardTitle></CardHeader>
        <CardContent><ResponsiveContainer width="100%" height={300}><LineChart data={report.series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} /><Legend /><Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" /><Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" /></LineChart></ResponsiveContainer></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Daily Profit Analysis</CardTitle></CardHeader>
        <CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={report.series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} /><Legend /><Bar dataKey="profit" fill="#3b82f6" name="Daily Profit" /></BarChart></ResponsiveContainer></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Revenue Breakdown</CardTitle></CardHeader>
        <CardContent>{slices.length === 0 ? <p className="py-12 text-center text-gray-500">No revenue or expenses in this range.</p> : <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={slices} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: KES ${Number(value).toLocaleString()}`} outerRadius={100} dataKey="value">{slices.map((slice) => <Cell key={slice.name} fill={slice.name === 'Profit' ? '#10b981' : '#ef4444'} />)}</Pie></PieChart></ResponsiveContainer>}</CardContent>
      </Card>
    </>
  );
}
