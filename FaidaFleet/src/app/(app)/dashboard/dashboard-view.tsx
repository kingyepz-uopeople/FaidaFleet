import Link from 'next/link'
import {
  TrendingUp,
  Wallet,
  Receipt,
  Truck,
  Users,
  BadgeCheck,
  AlertTriangle,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WeeklyChart } from './weekly-chart'
import type { ComplianceIssue } from '@/lib/fleet-metrics'

export type RecentCollection = {
  id: string
  registration: string
  paymentMethod: string
  amount: number
  status: 'Recorded' | 'Reconciled' | 'Pending'
}

export type FleetHomeProps = {
  userName: string
  fleetName: string
  vehicleCount: number
  driverCount: number
  totalCollections: number
  totalExpenses: number
  collectionCount: number
  expenseCount: number
  reconciliation: {
    rate: number
    reconciled: number
    pending: number
    electronicCount: number
  }
  chartData: { day: string; collections: number; expenses: number }[]
  recent: RecentCollection[]
  compliance: ComplianceIssue[]
  error?: string | null
}

function kes(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`
}

function statusClass(status: RecentCollection['status']) {
  if (status === 'Pending') return 'bg-amber-100 text-amber-800'
  return 'bg-green-100 text-green-800'
}

export function FleetHome({
  userName,
  fleetName,
  vehicleCount,
  driverCount,
  totalCollections,
  totalExpenses,
  collectionCount,
  expenseCount,
  reconciliation,
  chartData,
  recent,
  compliance,
  error,
}: FleetHomeProps) {
  const netProfit = totalCollections - totalExpenses

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-lg p-6 border border-blue-200/20 dark:border-blue-800/30">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Welcome back, {userName}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Managing <span className="font-bold text-foreground text-lg">{fleetName}</span> • {vehicleCount} vehicles • {driverCount} drivers
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200/50 dark:border-green-800/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Collections</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-200 mt-2">{kes(totalCollections)}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">{collectionCount} transactions</p>
            </div>
            <Wallet className="h-8 w-8 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg p-6 border border-red-200/50 dark:border-red-800/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Total Expenses</p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-200 mt-2">{kes(totalExpenses)}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{expenseCount} expenses</p>
            </div>
            <Receipt className="h-8 w-8 text-red-500 opacity-20" />
          </div>
        </div>

        <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20' : 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20'} rounded-lg p-6 border ${netProfit >= 0 ? 'border-blue-200/50 dark:border-blue-800/30' : 'border-amber-200/50 dark:border-amber-800/30'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-medium ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>Net Profit</p>
              <p className={`text-3xl font-bold mt-2 ${netProfit >= 0 ? 'text-blue-700 dark:text-blue-200' : 'text-amber-700 dark:text-amber-200'}`}>{kes(netProfit)}</p>
              <p className={`text-xs mt-1 ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>{netProfit >= 0 ? 'Positive' : 'Negative'}</p>
            </div>
            <TrendingUp className={`h-8 w-8 opacity-20 ${netProfit >= 0 ? 'text-blue-500' : 'text-amber-500'}`} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border border-purple-200/50 dark:border-purple-800/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Reconciliation Rate</p>
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-200 mt-2">{reconciliation.rate}%</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{reconciliation.reconciled} of {reconciliation.electronicCount} M-Pesa</p>
            </div>
            <BadgeCheck className="h-8 w-8 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/collections" className="group">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">Record Collection</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Log today&apos;s revenue</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/expenses" className="group">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
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
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">Manage Drivers</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">View and update drivers</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {compliance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Compliance alerts
            </CardTitle>
            <CardDescription>Insurance and inspection dates that need attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {compliance.slice(0, 5).map((issue) => (
              <div key={`${issue.id}-${issue.label}`} className="flex items-center justify-between gap-3">
                <Link href="/vehicles" className="font-medium hover:underline">
                  {issue.registration}
                </Link>
                <Badge className={issue.severity === 'expired' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                  {issue.label}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                <p className="text-2xl font-bold">{vehicleCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Active Drivers</p>
                <p className="text-2xl font-bold">{driverCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Status</CardTitle>
            <CardDescription>M-Pesa and Pochi transactions.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4 rounded-lg border p-4">
            <BadgeCheck className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Reconciled / Pending</p>
              <p className="text-2xl font-bold">
                <span className="text-green-500">{reconciliation.reconciled}</span> / <span className="text-amber-500">{reconciliation.pending}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <WeeklyChart data={chartData} />
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
                {recent.length > 0 ? (
                  recent.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="font-medium">{tx.registration}</div>
                        <div className="text-sm text-muted-foreground capitalize">{tx.paymentMethod || 'Cash'}</div>
                      </TableCell>
                      <TableCell>{kes(tx.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusClass(tx.status)}>
                          {tx.status}
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
  )
}
