import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
  loading = false,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Replaces the title/action with a neutral skeleton until access + data load. */
  loading?: boolean
}) {
  return (
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8', className)}>
      {(title || actions || loading) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {loading ? (
              <div role="status" aria-label="Loading page heading">
                <span className="sr-only">Loading…</span>
                <Skeleton className="h-7 w-40 sm:h-8" />
                <Skeleton className="mt-2 h-4 w-56 max-w-full" />
              </div>
            ) : (
              <>
                {title && <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>}
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              </>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap gap-2">
              {loading ? <Skeleton className="h-11 w-36 rounded-md" /> : actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/40 px-4 py-12 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** A failed fetch is not an empty list: never show "0 recorded" in that case. */
export function LoadFailure({
  label,
  message,
  onRetry,
}: {
  label: string
  message?: string
  onRetry: () => void
}) {
  return (
    <EmptyState
      title={`Could not load ${label}`}
      description={message || 'Check your connection and try again.'}
      action={
        <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="hidden min-w-0 overflow-x-auto md:block">
      {children}
    </div>
  )
}
