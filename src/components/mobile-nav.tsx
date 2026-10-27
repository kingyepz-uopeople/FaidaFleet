'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { bottomNavForRole } from '@/lib/nav'
import { navPath } from '@/lib/fleet-access'
import { Skeleton } from '@/components/ui/skeleton'

export function MobileBottomNav({ role, loading = false }: { role: string; loading?: boolean }) {
  const pathname = usePathname()
  const items = bottomNavForRole(role)

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {loading ? (
        <ul className="grid grid-cols-5" role="status" aria-label="Loading navigation">
          <li className="sr-only">Loading navigation…</li>
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} aria-hidden="true" className="flex min-h-12 flex-col items-center justify-center gap-1 px-0.5 py-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-2 w-10 rounded" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-5">
          {items.map(({ href, label, Icon }) => {
            const path = navPath(href)
            // Quick-action links (Log fuel) are buttons, not a separate page.
            const active = !href.includes('?') && (pathname === path || pathname.startsWith(`${path}/`))
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[11px] font-medium',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="w-full truncate text-center">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
