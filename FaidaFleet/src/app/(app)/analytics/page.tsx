'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type FinancialData = { date: string; revenue: number; expenses: number; profit: number };

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30'); 
  const [data, setData] = useState<FinancialData[]>([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalExpenses: 0, totalProfit: 0, profitMargin: 0 });
  const supabase = createClient();

  useEffect(() => { fetchData(); }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const membershipResp = await supabase.from('memberships').select('tenant_id').eq('user_id', user.id).eq('is_active', true).single();
      const membership: any = membershipResp.data;
      if (!membership) throw new Error('No tenant found');

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
      const startDate = daysAgo.toISOString().split('T')[0];

      const [collectionsRes, expensesRes] = await Promise.all([
        supabase.from('collections').select('date, amount').eq('tenant_id', membership.tenant_id).gte('date', startDate),
        supabase.from('expenses').select('date, amount').eq('tenant_id', membership.tenant_id).gte('date', startDate)
      ]);

      const collections: any[] = collectionsRes.data || [];
      const expenses: any[] = expensesRes.data || [];

      const dateMap = new Map<string, { revenue: number; expenses: number }>();
      collections.forEach(c => {
        const entry = dateMap.get(c.date) || { revenue: 0, expenses: 0 };
        entry.revenue += parseFloat(c.amount);
        dateMap.set(c.date, entry);
      });
      expenses.forEach(e => {
        const entry = dateMap.get(e.date) || { revenue: 0, expenses: 0 };
        entry.expenses += parseFloat(e.amount);
        dateMap.set(e.date, entry);
      });

      const financialData = Array.from(dateMap.entries()).map(([date, { revenue, expenses }]) => ({
        date,
        revenue,
        expenses,
        profit: revenue - expenses
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalRevenue = financialData.reduce((sum, d) => sum + d.revenue, 0);
      const totalExpenses = financialData.reduce((sum, d) => sum + d.expenses, 0);
      const totalProfit = totalRevenue - totalExpenses;

      setData(financialData);
      setStats({ totalRevenue, totalExpenses, totalProfit, profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div><h1 className="text-3xl font-bold">Financial Analytics</h1><p className="text-gray-600 dark:text-gray-400">Revenue, expenses, and profitability reports</p></div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Date Range</CardTitle></CardHeader>
        <CardContent><Select value={dateRange} onValueChange={setDateRange}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 Days</SelectItem><SelectItem value="30">Last 30 Days</SelectItem><SelectItem value="90">Last 90 Days</SelectItem></SelectContent></Select></CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-600" />Total Revenue</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">KES {stats.totalRevenue.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="h-5 w-5 text-red-600" />Total Expenses</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-600">KES {stats.totalExpenses.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-600" />Net Profit</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">KES {stats.totalProfit.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Percent className="h-5 w-5 text-purple-600" />Profit Margin</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-purple-600">{stats.profitMargin}%</p></CardContent></Card>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div> : (
        <>
          <Card><CardHeader><CardTitle>Revenue vs Expenses Trend</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} /><Legend /><Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" /><Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" /></LineChart></ResponsiveContainer></CardContent></Card>

          <Card><CardHeader><CardTitle>Daily Profit Analysis</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} /><Legend /><Bar dataKey="profit" fill="#3b82f6" name="Daily Profit" /></BarChart></ResponsiveContainer></CardContent></Card>

          <Card><CardHeader><CardTitle>Revenue Breakdown</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={[{ name: 'Profit', value: stats.totalProfit }, { name: 'Expenses', value: stats.totalExpenses }]} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: KES ${Number(value).toLocaleString()}`} outerRadius={100} fill="#8884d8" dataKey="value"><Cell fill="#10b981" /><Cell fill="#ef4444" /></Pie></PieChart></ResponsiveContainer></CardContent></Card>
        </>
      )}
    </div>
  );
}
