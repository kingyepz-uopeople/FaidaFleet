'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  AdministratorDeveloper,
  Car,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { adminNavGroups, adminPageMeta, isAdminNavActive } from '@/lib/nav'
import { isAdminUiPreview } from '@/lib/admin-preview'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const SIDEBAR_KEY = 'faidafleet-admin-sidebar'
const PREVIEW_NAME = 'Ian'
const PREVIEW_EMAIL = 'ian@faidafleet.com'

type AdminIdentity = {
  name: string
  email: string
}

/**
 * Display name rule for system administrators:
 * admin_users.full_name, then profiles.full_name, then the email local part.
 */
export function adminDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = fullName?.trim()
  if (trimmed) return trimmed
  const local = email?.split('@')[0]?.trim()
  return local || 'System admin'
}

/** The single avatar mark for system admins everywhere in the console. */
export function AdminAvatar({
  tone = 'light',
  className,
  iconClassName,
}: {
  tone?: 'light' | 'dark'
  className?: string
  iconClassName?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        tone === 'dark' ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary',
        className,
      )}
    >
      <AdministratorDeveloper className={cn('h-5 w-5', iconClassName)} />
    </span>
  )
}

function AdminLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Car className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">FaidaFleet</span>
          <span className="block truncate text-[11px] text-white/55">System admin</span>
        </span>
      )}
    </span>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const preview = isAdminUiPreview()
  const [user, setUser] = useState<User | null>(null)
  const [identity, setIdentity] = useState<AdminIdentity | null>(
    preview ? { name: PREVIEW_NAME, email: PREVIEW_EMAIL } : null,
  )
  const [isAdmin, setIsAdmin] = useState(preview)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const pathname = usePathname()
  const router = useRouter()
  const page = adminPageMeta(pathname)

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1')
  }, [])

  useEffect(() => {
    if (preview) {
      setIsAdmin(true)
      return
    }

    const loadAdmin = async () => {
      const { data: { user: nextUser } } = await supabase.auth.getUser()
      setUser(nextUser)

      if (!nextUser) {
        router.push('/admin-login')
        return
      }

      const { data: adminRows } = await supabase
        .from('admin_users')
        .select('id, full_name, email, is_active')
        .eq('user_id', nextUser.id)
        .eq('is_active', true)
        .limit(1)

      const adminRow = adminRows?.[0]

      if (!adminRow) {
        const { data: memberships } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', nextUser.id)
          .eq('is_active', true)
          .limit(1)
        router.push(memberships && memberships.length > 0 ? '/dashboard' : '/admin-login')
        return
      }

      let profileName: string | null = null
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', nextUser.id)
        .maybeSingle()
      profileName = profile?.full_name ?? null

      const email = adminRow.email || nextUser.email || ''
      const name = adminRow.full_name?.trim() || profileName?.trim() || adminDisplayName(null, email)
      setIdentity({ name, email })
      setIsAdmin(true)
    }

    loadAdmin()
  }, [preview, router, supabase])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const displayName = preview
    ? PREVIEW_NAME
    : identity?.name || adminDisplayName(null, user?.email)
  const displayEmail = preview ? PREVIEW_EMAIL : identity?.email || user?.email || 'System admin'

  const handleLogout = async () => {
    if (!preview) await supabase.auth.signOut()
    router.push('/admin-login')
  }

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
  }

  const nav = (compact: boolean) => (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      <TooltipProvider delayDuration={0}>
        {adminNavGroups.map((group) => (
          <div key={group.label}>
            {!compact && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isAdminNavActive(pathname, item.href)
                const link = (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                      active ? 'bg-white/12 text-white shadow-sm' : 'text-white/70 hover:bg-white/5 hover:text-white',
                      compact && 'justify-center px-0',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <item.Icon className="h-5 w-5 shrink-0" />
                    {!compact && <span>{item.label}</span>}
                  </Link>
                )
                if (!compact) return <div key={item.href}>{link}</div>
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        ))}
      </TooltipProvider>
    </nav>
  )

  const identityBlock = (compact: boolean) => (
    <div
      className={cn(
        'flex items-center gap-3 border-t border-white/10 p-3',
        compact && 'flex-col gap-2 px-2',
      )}
    >
      <AdminAvatar tone="dark" />
      {!compact && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-white/55">{displayEmail}</p>
        </div>
      )}
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Sign out"
        className={cn(
          'flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/70 hover:bg-white/5 hover:text-white',
          !compact && 'ml-auto',
        )}
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )

  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Checking admin access…
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh overflow-hidden bg-[hsl(220_20%_97%)]">
      <aside
        className={cn(
          'relative hidden shrink-0 flex-col bg-[#161b2c] text-white lg:flex',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-white/10', collapsed ? 'justify-center' : 'gap-2 px-4')}>
          <AdminLogo compact={collapsed} />
        </div>
        {nav(collapsed)}
        {identityBlock(collapsed)}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="absolute -right-3 top-16 z-20 flex h-11 w-11 items-center justify-center rounded-full border bg-background text-foreground shadow-sm"
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(20rem,calc(100vw-1.5rem))] bg-[#161b2c] p-0 text-white">
          <SheetHeader className="border-b border-white/10 p-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-white">
              <AdminLogo />
            </SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100dvh-4rem)] flex-col pb-[env(safe-area-inset-bottom)]">
            {nav(false)}
            {identityBlock(false)}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{page.label}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">System administration</p>
          </div>
          <div className="flex items-center gap-2">
            <AdminAvatar />
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[12rem] truncate text-sm font-medium">{displayName}</p>
              <p className="max-w-[12rem] truncate text-xs text-muted-foreground">{displayEmail}</p>
            </div>
          </div>
          <Button variant="outline" className="min-h-11" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
