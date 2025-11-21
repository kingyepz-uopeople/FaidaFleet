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
    <div className="flex flex-col gap-6 p-6">
      {/* Welcome Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-lg p-6 border border-blue-200/20 dark:border-blue-800/30">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Welcome back, {userName}! 👋</h1>
        <p className="text-muted-foreground mt-2">
          Managing <span className="font-bold text-foreground text-lg">{fleetName}</span> • {vehicles?.length || 0} vehicles • {drivers?.length || 0} drivers
        </p>
      </div>

      {/* Key Metrics with Enhanced Design */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200/50 dark:border-green-800/30 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Collections</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-200 mt-2">KES {(totalCollections / 1000).toFixed(1)}K</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">{collections?.length || 0} transactions</p>
            </div>
            <Wallet className="h-8 w-8 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg p-6 border border-red-200/50 dark:border-red-800/30 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Total Expenses</p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-200 mt-2">KES {(totalExpenses / 1000).toFixed(1)}K</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{expenses?.length || 0} expenses</p>
            </div>
            <Receipt className="h-8 w-8 text-red-500 opacity-20" />
          </div>
        </div>

        <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20' : 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20'} rounded-lg p-6 border ${netProfit >= 0 ? 'border-blue-200/50 dark:border-blue-800/30' : 'border-amber-200/50 dark:border-amber-800/30'} hover:shadow-lg transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-medium ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>Net Profit</p>
              <p className={`text-3xl font-bold mt-2 ${netProfit >= 0 ? 'text-blue-700 dark:text-blue-200' : 'text-amber-700 dark:text-amber-200'}`}>KES {(netProfit / 1000).toFixed(1)}K</p>
              <p className={`text-xs mt-1 ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>{netProfit >= 0 ? '📈 Positive' : '📉 Negative'}</p>
            </div>
            <TrendingUp className={`h-8 w-8 opacity-20 ${netProfit >= 0 ? 'text-blue-500' : 'text-amber-500'}`} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border border-purple-200/50 dark:border-purple-800/30 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Reconciliation Rate</p>
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-200 mt-2">{mpesaCollections.length > 0 ? Math.round((reconciledCount / mpesaCollections.length) * 100) : 0}%</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{reconciledCount} of {mpesaCollections.length} M-Pesa</p>
            </div>
            <BadgeCheck className="h-8 w-8 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/collections" className="group">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">Record Collection</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Log today's revenue</p>
              </div>
            </div>
          </div>
        </Link>
        
        <Link href="/expenses" className="group">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-800/50 transition-colors">
                <Receipt className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400">Log Expense</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Track expenditures</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/drivers" className="group">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">Manage Drivers</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">View & update drivers</p>
              </div>
            </div>
          </div>
        </Link>
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
