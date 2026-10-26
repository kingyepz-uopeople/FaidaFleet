'use client'

import { useEffect, useState, type ReactNode } from 'react'
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
import { accountLabel } from '@/lib/phone'
import { isAdminUiPreview } from '@/lib/admin-preview'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const SIDEBAR_KEY = 'faidafleet-admin-sidebar'

function AdminAvatar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground',
        className,
      )}
      aria-hidden="true"
    >
      <AdministratorDeveloper className="h-5 w-5" />
    </span>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const preview = isAdminUiPreview()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(preview)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()
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

    const checkAdmin = async () => {
      const { data: { user: nextUser } } = await supabase.auth.getUser()
      setUser(nextUser)

      if (nextUser) {
        const { data: adminRows } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', nextUser.id)
          .eq('is_active', true)
          .limit(1)

        if (adminRows && adminRows.length > 0) {
          setIsAdmin(true)
        } else {
          const { data: memberships } = await supabase
            .from('memberships')
            .select('id')
            .eq('user_id', nextUser.id)
            .eq('is_active', true)
            .limit(1)
          router.push(memberships && memberships.length > 0 ? '/dashboard' : '/admin-login')
        }
      } else {
        router.push('/admin-login')
      }
    }

    checkAdmin()
  }, [preview, router, supabase])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    if (!preview) await supabase.auth.signOut()
    router.push('/admin-login')
  }

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
  }

  const displayName = preview ? 'Ian' : accountLabel(user) || 'Admin'
  const displayEmail = preview ? 'ian@faidafleet.com' : user?.email || 'System admin'

  const nav = (compact: boolean) => (
    <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
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
                      active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
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

  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Checking admin access…
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          'relative hidden h-dvh min-h-0 shrink-0 flex-col bg-[#152238] text-white md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-white/10', collapsed ? 'justify-center' : 'px-4')}>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5">
              <Car className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">FaidaFleet</p>
                <p className="truncate text-[11px] text-white/55">System admin</p>
              </div>
            )}
          </div>
        </div>
        {nav(collapsed)}
        <div className="space-y-2 border-t border-white/10 p-3">
          <div className={cn('flex min-h-11 items-center gap-3 rounded-xl p-2', collapsed && 'justify-center')}>
            <AdminAvatar className="h-8 w-8" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-white/60">{displayEmail}</p>
              </div>
            )}
          </div>
        </div>
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
        <SheetContent side="left" className="w-[min(20rem,calc(100vw-1.5rem))] bg-[#152238] p-0 text-white">
          <SheetHeader className="border-b border-white/10 p-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-white">
              <Car className="h-5 w-5" />
              FaidaFleet
            </SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100dvh-4rem)] flex-col pb-[env(safe-area-inset-bottom)]">
            {nav(false)}
            <div className="border-t border-white/10 p-3">
              <div className="flex min-h-11 items-center gap-3 rounded-xl p-2">
                <AdminAvatar className="h-8 w-8" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-white/60">{displayEmail}</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur sm:h-16 sm:px-6 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight sm:text-xl">{page.label}</h1>
          <div className="flex items-center gap-2">
            <AdminAvatar />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
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
