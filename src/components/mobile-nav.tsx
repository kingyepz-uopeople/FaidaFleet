'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { bottomNavForRole } from '@/lib/nav'
import { navPath } from '@/lib/fleet-access'

export function MobileBottomNav({ role }: { role: string }) {
  const pathname = usePathname()
  const items = bottomNavForRole(role)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
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
    </nav>
  )
}
