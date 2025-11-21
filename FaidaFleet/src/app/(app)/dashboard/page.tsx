import React from 'react';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { WeeklyChart } from './weekly-chart';

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's tenant membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    redirect('/onboarding')
  }

  const tenantId = membership.tenant_id

  // Fetch fleet data
  const [
    { data: vehicles },
    { data: drivers },
    { data: collections },
    { data: expenses },
    { data: tenant }
  ] = await Promise.all([
    supabase.from('vehicles').select('*').eq('tenant_id', tenantId),
    supabase.from('drivers').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('collections').select('*, vehicles(registration_number)').eq('tenant_id', tenantId).order('collected_at', { ascending: false }).limit(50),
    supabase.from('expenses').select('*').eq('tenant_id', tenantId).order('expense_date', { ascending: false }).limit(50),
    supabase.from('tenants').select('name').eq('id', tenantId).single()
  ])

  // Calculate totals
  const totalCollections = collections?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
  const netProfit = totalCollections - totalExpenses

  // Get reconciliation status for M-Pesa collections
  const mpesaCollections = collections?.filter(c => c.payment_method === 'mpesa') || []
  const reconciledCount = mpesaCollections.filter(c => c.mpesa_transaction_id).length
  const pendingCount = mpesaCollections.length - reconciledCount

  // Get last 7 days data for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return date.toISOString().split('T')[0]
  })

  const chartData = last7Days.map((date, index) => {
    const dayCollections = collections?.filter(c => 
      c.collected_at?.startsWith(date)
    ).reduce((sum, c) => sum + (c.amount || 0), 0) || 0
    
    const dayExpenses = expenses?.filter(e => 
      e.expense_date?.startsWith(date)
    ).reduce((sum, e) => sum + (e.amount || 0), 0) || 0

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dayOfWeek = new Date(date).getDay()
    
    return {
      date: days[dayOfWeek],
      collections: dayCollections,
      expenses: dayExpenses
    }
  })

  // Get recent transactions (last 5)
  const recentTransactions = collections?.slice(0, 5) || []

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.full_name || user.email?.split('@')[0] || 'Fleet Owner'
  const fleetName = tenant?.name || 'Your Fleet'
  
  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {userName}!</h1>
        <p className="text-muted-foreground">
          Managing <span className="font-semibold text-foreground">{fleetName}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Collections"
          value={`KES ${totalCollections.toLocaleString()}`}
          description={collections && collections.length > 0 ? `${collections.length} transactions recorded` : 'No collections yet'}
          Icon={Wallet}
        />
        <StatCard
          title="Total Expenses"
          value={`KES ${totalExpenses.toLocaleString()}`}
          description={expenses && expenses.length > 0 ? `${expenses.length} expenses recorded` : 'No expenses yet'}
          Icon={Receipt}
        />
        <StatCard
          title="Net Profit"
          value={`KES ${netProfit.toLocaleString()}`}
          description={netProfit >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
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
                    <p className="text-2xl font-bold">{vehicles?.length || 0}</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg border p-4">
                 <Users className="h-8 w-8 text-primary" />
                 <div>
                    <p className="text-sm text-muted-foreground">Active Drivers</p>
                    <p className="text-2xl font-bold">{drivers?.length || 0}</p>
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
                    <span className="text-green-500">{reconciledCount}</span> / <span className="text-amber-500">{pendingCount}</span>
                  </p>
               </div>
            </CardContent>
          </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <WeeklyChart data={chartData.map(d => ({
            day: d.date,
            collections: d.collections,
            expenses: d.expenses
          }))} />
        </div>

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
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="font-medium">{tx.vehicles?.registration_number || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground capitalize">{tx.payment_method || 'Cash'}</div>
                      </TableCell>
                      <TableCell>KES {tx.amount?.toLocaleString() || 0}</TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.mpesa_transaction_id ? 'default' : 'secondary'}
                          className={tx.mpesa_transaction_id ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                        >
                          {tx.mpesa_transaction_id ? 'Reconciled' : 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No collections yet. Start by adding your first collection.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
