'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Car,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
} from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppHeader } from '@/components/app-header';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { accountInitials, accountLabel } from '@/lib/phone';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { MustChangePinDialog } from '@/components/must-change-pin-dialog';
import { MobileBottomNav } from '@/components/mobile-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { FleetAccessProvider, useFleetAccess } from '@/components/fleet-access-provider';
import { fleetHelpItem, fleetMenuForRole } from '@/lib/nav';
import { homePathForRole, isNavActive, isPathAllowedForDriver } from '@/lib/fleet-access';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FleetAccessProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </FleetAccessProvider>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, role, isDriver, mustChangePin, loading } = useFleetAccess();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const displayRole = isDriver ? 'driver' : role;
  const userRole = displayRole ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1) : 'Member';
  const menuItems = fleetMenuForRole(displayRole);
  const homeHref = homePathForRole(displayRole);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Client-side part of the route guard (middleware also blocks direct URLs).
  useEffect(() => {
    if (loading) return;
    if (mustChangePin && pathname !== '/settings') {
      router.replace('/settings');
      return;
    }
    if (isDriver && !isPathAllowedForDriver(pathname)) {
      router.replace('/trips');
    }
  }, [isDriver, loading, mustChangePin, pathname, router]);

  const setTheme = (dark: boolean) => {
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('faidafleet-theme', dark ? 'dark' : 'light');
  };

  const navLinks = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      <TooltipProvider delayDuration={0}>
        {menuItems.map(({ href, label, Icon }) => {
          const isActive = isNavActive(pathname, href);
          return (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white',
                    isCollapsed && 'justify-center px-0',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{label}</span>}
                </Link>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">{label}</TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </nav>
  );

  const signOutControl = (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SignOutButton
            label="Sign out"
            className={cn(
              'w-full gap-3 rounded-xl px-3 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white',
              isCollapsed && 'justify-center px-0',
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Sign out</span>}
          </SignOutButton>
        </TooltipTrigger>
        {isCollapsed && <TooltipContent side="right">Sign out</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="flex min-h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          'relative hidden shrink-0 flex-col bg-[#152238] text-white md:flex',
          isCollapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('flex min-h-14 items-center border-b border-white/10 pt-[env(safe-area-inset-top)]', isCollapsed ? 'justify-center' : 'px-4')}>
          <Link href={homeHref} className="flex min-h-11 items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5">
              <Car className="h-5 w-5" />
            </div>
            {!isCollapsed && <span className="text-base font-semibold">FaidaFleet</span>}
          </Link>
        </div>
        {navLinks}
        <div className="space-y-1 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!isDriver && (
            <Link
              href={fleetHelpItem.href}
              className={cn('flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-white/70 hover:bg-white/5 hover:text-white', isCollapsed && 'justify-center px-0')}
            >
              <fleetHelpItem.Icon className="h-5 w-5" />
              {!isCollapsed && <span>{fleetHelpItem.label}</span>}
            </Link>
          )}
          <Link href="/settings" className={cn('flex min-h-12 items-center gap-3 rounded-xl p-2 hover:bg-white/5', isCollapsed && 'justify-center')}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url || PlaceHolderImages[0].imageUrl} />
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">{accountInitials(user)}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{accountLabel(user)}</p>
                <p className="truncate text-xs text-white/60">{userRole}</p>
              </div>
            )}
          </Link>
          {signOutControl}
          <div className={cn('flex rounded-xl bg-white/5 p-1', isCollapsed && 'justify-center')}>
            <button type="button" onClick={() => setTheme(true)} className={cn('flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-lg', isDark && 'bg-white/10 text-white')} aria-label="Dark theme">
              <Moon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setTheme(false)} className={cn('flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-lg', !isDark && 'bg-white/10 text-white')} aria-label="Light theme">
              <Sun className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-16 z-20 flex h-11 w-11 items-center justify-center rounded-full border bg-background text-foreground shadow-sm"
          aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(20rem,calc(100vw-1.5rem))] bg-[#152238] p-0 text-white">
          <SheetHeader className="border-b border-white/10 p-4 pt-[max(1rem,env(safe-area-inset-top))] text-left">
            <SheetTitle className="flex items-center gap-2 text-white">
              <Car className="h-5 w-5" />
              FaidaFleet
            </SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100dvh-4rem)] flex-col">
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {menuItems.map(({ href, label, Icon }) => {
                const isActive = isNavActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium',
                      isActive ? 'bg-white/10 text-white' : 'text-white/70',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="space-y-1 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm text-white/70 hover:bg-white/5 hover:text-white" onClick={() => setTheme(!isDark)}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? 'Light theme' : 'Dark theme'}
              </button>
              <SignOutButton
                label="Sign out"
                className="w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <MobileBottomNav role={displayRole || ''} />
      <InstallPrompt />
      <MustChangePinDialog />
    </div>
  );
}
