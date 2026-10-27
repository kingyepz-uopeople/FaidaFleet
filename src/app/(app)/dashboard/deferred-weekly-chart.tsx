'use client'

import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { WeeklyChartProps } from './weekly-chart'

const WeeklyChart = dynamic(() => import('./weekly-chart').then((module) => module.WeeklyChart), {
  ssr: false,
  loading: () => (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Overview</CardTitle>
        <CardDescription>Collections vs Expenses for the last 7 days.</CardDescription>
      </CardHeader>
      <CardContent><Skeleton className="h-[300px] w-full" aria-label="Loading weekly chart" /></CardContent>
    </Card>
  ),
})

export function DeferredWeeklyChart(props: WeeklyChartProps) {
  return <WeeklyChart {...props} />
}
