'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Car,
  LogOut,
  Shield,
  Package,
  TrendingUp,
  Wallet,
  User as UserIcon,
  Settings,
  BarChart3,
  AlertCircle,
  Menu,
  KeyRound,
} from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { accountInitials, accountLabel } from '@/lib/phone';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const adminMenuItems = [
  { href: '/admin', label: 'Overview', Icon: LayoutDashboard },
  { href: '/admin/analytics', label: 'Analytics', Icon: TrendingUp },
  { href: '/admin/collections', label: 'Collections', Icon: Wallet },
  { href: '/admin/billing', label: 'Billing', Icon: BarChart3 },
  { href: '/admin/fleet-owners', label: 'Fleet Owners', Icon: Users },
  { href: '/admin/drivers', label: 'All Drivers', Icon: Car },
  { href: '/admin/users', label: 'Admin Users', Icon: UserIcon },
  { href: '/admin/pin-resets', label: 'PIN resets', Icon: KeyRound },
  { href: '/admin/plans', label: 'Plans', Icon: Package },
  { href: '/admin/settings', label: 'Settings', Icon: Settings },
  { href: '/admin/support', label: 'Support', Icon: AlertCircle },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: adminRows } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        if (adminRows && adminRows.length > 0) {
          setIsAdmin(true);
        } else {
          const { data: memberships } = await supabase
            .from('memberships')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1);
          router.push(memberships && memberships.length > 0 ? '/dashboard' : '/admin-login');
        }
      } else {
        router.push('/admin-login');
      }
    };

    checkAdmin();
  }, [supabase, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin-login');
  };

  const links = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {adminMenuItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium',
              isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
            )}
          >
            <item.Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  if (!isAdmin) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex min-h-dvh overflow-hidden bg-background">
      <aside className="relative hidden w-60 shrink-0 flex-col bg-[#1a1520] text-white lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <div className="rounded-lg bg-rose-600 p-1.5">
            <Shield className="h-5 w-5" />
          </div>
          <span className="font-semibold">Admin</span>
        </div>
        {links}
        <div className="space-y-2 border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-rose-600 text-white text-xs">{accountInitials(user)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{accountLabel(user) || 'Admin'}</p>
              <p className="truncate text-xs text-white/60">System admin</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="ghost" className="min-h-11 w-full justify-start text-white/80 hover:text-white">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(20rem,calc(100vw-1.5rem))] bg-[#1a1520] p-0 text-white">
          <SheetHeader className="border-b border-white/10 p-4 text-left">
            <SheetTitle className="text-white">Admin</SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100dvh-4rem)] flex-col">
            {links}
            <div className="border-t border-white/10 p-3">
              <Button onClick={handleLogout} variant="ghost" className="min-h-11 w-full justify-start text-white">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur lg:hidden pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
