'use client'

import type { ComponentType, ReactNode } from 'react'
import { Search, TrendingDown, TrendingUp } from '@/components/icons'
import type { IconProps } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/page-shell'
import { cn } from '@/lib/utils'

export const adminSelectClass =
  'flex h-11 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function formatKes(value: number) {
  return `KES ${Math.round(value).toLocaleString('en-KE')}`
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function titleCase(value: string | null | undefined) {
  if (!value) return '—'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function AdminKpi({
  title,
  value,
  hint,
  Icon,
  trend,
}: {
  title: string
  value: string
  hint?: string
  Icon?: ComponentType<IconProps>
  trend?: { direction: 'up' | 'down' | 'flat'; label: string }
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {(hint || trend) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                    trend.direction === 'up' && 'bg-emerald-50 text-emerald-700',
                    trend.direction === 'down' && 'bg-rose-50 text-rose-700',
                    trend.direction === 'flat' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {trend.direction === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                  {trend.label}
                </span>
              )}
              {hint && <span>{hint}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-10"
        type="search"
      />
    </div>
  )
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'plan'
  children: ReactNode
}) {
  const tones = {
    success: 'border-transparent bg-emerald-50 text-emerald-800',
    warning: 'border-transparent bg-amber-50 text-amber-800',
    danger: 'border-transparent bg-rose-50 text-rose-800',
    info: 'border-transparent bg-sky-50 text-sky-800',
    plan: 'border-transparent bg-indigo-50 text-indigo-800',
    neutral: 'border-transparent bg-muted text-muted-foreground',
  }
  return <Badge className={cn('font-medium', tones[tone])}>{children}</Badge>
}

export function planTone(plan: string): 'plan' | 'info' | 'neutral' {
  if (plan === 'enterprise') return 'plan'
  if (plan === 'pro') return 'info'
  return 'neutral'
}

export function AdminFeedback({ error, success }: { error?: string | null; success?: string | null }) {
  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </>
  )
}

export function AdminLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

export type AdminColumn<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
  mobileLabel?: string
  hideOnMobile?: boolean
}

export function AdminRecordList<T>({
  rows,
  columns,
  rowKey,
  actions,
  loading,
  emptyTitle,
  emptyDescription,
}: {
  rows: T[]
  columns: AdminColumn<T>[]
  rowKey: (row: T) => string
  actions?: (row: T) => ReactNode
  loading?: boolean
  emptyTitle: string
  emptyDescription?: string
}) {
  if (loading) return <AdminLoading />
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="max-h-[70dvh] overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b">
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className={cn('h-12 px-4 text-left align-middle font-medium text-muted-foreground', column.className)}
                  >
                    {column.header}
                  </th>
                ))}
                {actions && <th className="h-12 w-14 px-4" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/40">
                  {columns.map((column) => (
                    <td key={column.id} className={cn('p-4 align-middle', column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {actions && <td className="p-2 text-right">{actions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <article key={rowKey(row)} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="space-y-2">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column, index) => (
                  <div key={column.id} className={cn(index === 0 ? 'text-base font-semibold' : 'flex items-start justify-between gap-3 text-sm')}>
                    {index > 0 && (
                      <span className="text-muted-foreground">{column.mobileLabel || column.header}</span>
                    )}
                    <span className={cn(index > 0 && 'text-right')}>{column.cell(row)}</span>
                  </div>
                ))}
            </div>
            {actions && <div className="mt-3 flex justify-end border-t pt-3">{actions(row)}</div>}
          </article>
        ))}
      </div>
    </>
  )
}

export function RowActionsTrigger({ children }: { children: ReactNode }) {
  return (
    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Row actions">
      {children}
    </Button>
  )
}
