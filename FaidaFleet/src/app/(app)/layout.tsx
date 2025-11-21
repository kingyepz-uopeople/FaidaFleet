'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  Users,
  Wallet,
  Receipt,
  Settings,
  CircleHelp,
  Car,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppHeader } from '@/components/app-header';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/vehicles', label: 'Vehicles', Icon: Truck },
  { href: '/drivers', label: 'Drivers', Icon: Users },
  { href: '/collections', label: 'Collections', Icon: Wallet },
  { href: '/expenses', label: 'Expenses', Icon: Receipt },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('Member');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const supabase = createClient();
  const pathname = usePathname();

  // Sidebar should be expanded when NOT collapsed OR when hovered (even if collapsed)
  const isExpanded = !isCollapsed || isHovered;

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Get user's role from memberships
        const { data: membership } = await supabase
          .from('memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (membership) {
          // Capitalize role
          setUserRole(membership.role.charAt(0).toUpperCase() + membership.role.slice(1));
        }
      }
    };

    getUser();
  }, [supabase]);

  const getUserInitials = () => {
    if (!user) return 'U';
    const name = user.user_metadata?.full_name || user.email || '';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = () => {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Collapsible Sidebar */}
      <aside
        className={cn(
          'relative flex flex-col bg-gradient-to-b from-[#1a1d29] to-[#12141d] text-white transition-all duration-300 ease-in-out',
          isExpanded ? 'w-64' : 'w-16'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          {isExpanded && (
            <Link href="/dashboard" className="flex items-center gap-3 transition-opacity">
              <div className="rounded-lg bg-blue-500 p-1.5">
                <Car className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">FaidaFleet</span>
            </Link>
          )}
          {!isExpanded && (
            <Link href="/dashboard" className="flex w-full justify-center">
              <div className="rounded-lg bg-blue-500 p-1.5">
                <Car className="h-5 w-5" />
              </div>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <TooltipProvider delayDuration={0}>
            {menuItems.map(({ href, label, Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white',
                        !isExpanded && 'justify-center'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', !isExpanded ? '' : 'flex-shrink-0')} />
                      {isExpanded && <span>{label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {!isExpanded && (
                    <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">
                      {label}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10">
          {/* Help & Support */}
          <div className="px-3 py-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/help"
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-all hover:bg-white/5 hover:text-white',
                      !isExpanded && 'justify-center'
                    )}
                  >
                    <CircleHelp className="h-5 w-5 flex-shrink-0" />
                    {isExpanded && <span>Help & Support</span>}
                  </Link>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">
                    Help & Support
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* User Profile */}
          <div className="p-3">
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 rounded-lg p-2 transition-all hover:bg-white/5',
                !isExpanded && 'justify-center'
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url || PlaceHolderImages[0].imageUrl} />
                <AvatarFallback className="bg-blue-500 text-white text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              {isExpanded && (
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium">{getUserDisplayName()}</span>
                  <span className="truncate text-xs text-gray-400">{userRole}</span>
                </div>
              )}
            </Link>
          </div>

          {/* Theme Toggle */}
          <div className="px-3 pb-3">
            <div className={cn(
              'flex items-center gap-2 rounded-lg bg-white/5 p-1',
              !isExpanded && 'justify-center'
            )}>
              {isExpanded ? (
                <>
                  <button
                    onClick={() => setIsDark(true)}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      isDark ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                    )}
                  >
                    <Moon className="mx-auto h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIsDark(false)}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      !isDark ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                    )}
                  >
                    <Sun className="mx-auto h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="rounded-md p-1.5 text-gray-400 transition-all hover:text-white"
                >
                  {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#1a1d29] text-gray-400 transition-all hover:bg-white/5 hover:text-white"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
