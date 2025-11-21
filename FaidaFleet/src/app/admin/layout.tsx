'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Car,
  ChevronLeft,
  LogOut,
  Shield,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const adminMenuItems = [
  { href: '/admin', label: 'Overview', Icon: LayoutDashboard },
  { href: '/admin/fleet-owners', label: 'Fleet Owners', Icon: Users },
  { href: '/admin/drivers', label: 'All Drivers', Icon: Car },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  const isExpanded = !isCollapsed || isHovered;

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Check if user has admin role in any tenant or is system owner
        // For now, we'll check if they have any membership - you can add stricter checks
        const { data: memberships } = await supabase
          .from('memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (memberships && memberships.length > 0) {
          setIsAdmin(true);
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    };

    checkAdmin();
  }, [supabase, router]);

  const getUserInitials = () => {
    if (!user) return 'A';
    const name = user.user_metadata?.full_name || user.email || '';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = () => {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!isAdmin) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
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
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500 p-1.5">
                <Shield className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">Admin</span>
            </div>
          )}
          {!isExpanded && (
            <div className="flex w-full justify-center">
              <div className="rounded-lg bg-red-500 p-1.5">
                <Shield className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <TooltipProvider delayDuration={0}>
            {adminMenuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-red-500/20 text-red-400'
                          : 'text-gray-300 hover:bg-gray-700/50'
                      )}
                    >
                      <item.Icon className="h-5 w-5 flex-shrink-0" />
                      {isExpanded && <span>{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {!isExpanded && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-gray-700/30 p-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-red-500 text-white">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            {isExpanded && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{getUserDisplayName()}</p>
                <p className="truncate text-xs text-gray-400">System Admin</p>
              </div>
            )}
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700/50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isExpanded && 'Logout'}
          </Button>
        </div>

        {/* Collapse Button */}
        <div className="absolute -right-3 top-20 z-50">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-full bg-gray-700 p-1 hover:bg-gray-600 transition-colors"
          >
            {isCollapsed ? (
              <ChevronLeft className="h-4 w-4 rotate-180" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
