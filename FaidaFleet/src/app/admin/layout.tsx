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
  Package,
  TrendingUp,
  Wallet,
  User as UserIcon,
  Settings,
  BarChart3,
  AlertCircle,
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
  { href: '/admin/analytics', label: 'Analytics', Icon: TrendingUp },
  { href: '/admin/collections', label: 'Collections', Icon: Wallet },
  { href: '/admin/billing', label: 'Billing', Icon: BarChart3 },
  { href: '/admin/fleet-owners', label: 'Fleet Owners', Icon: Users },
  { href: '/admin/drivers', label: 'All Drivers', Icon: Car },
  { href: '/admin/users', label: 'Admin Users', Icon: UserIcon },
  { href: '/admin/plans', label: 'Plans', Icon: Package },
  { href: '/admin/settings', label: 'Settings', Icon: Settings },
  { href: '/admin/support', label: 'Support', Icon: AlertCircle },
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
      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes activeIndicator {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 4px;
            opacity: 1;
          }
        }

        .menu-item {
          position: relative;
          animation: slideInLeft 0.4s ease-out forwards;
        }
        
        .menu-item:nth-child(1) { animation-delay: 0.05s; }
        .menu-item:nth-child(2) { animation-delay: 0.1s; }
        .menu-item:nth-child(3) { animation-delay: 0.15s; }

        .menu-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 24px;
          background: linear-gradient(to bottom, rgb(239, 68, 68), rgb(220, 38, 38));
          border-radius: 0 2px 2px 0;
          animation: activeIndicator 0.3s ease-out;
        }

        .user-section {
          animation: slideInUp 0.5s ease-out;
        }

        .logout-btn {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .logout-btn:hover {
          transform: translateX(4px);
          background-color: rgba(239, 68, 68, 0.1) !important;
        }
      `}</style>

      {/* Sidebar */}
      <aside
        className={cn(
          'relative flex flex-col bg-gradient-to-b from-[#1a1d29] to-[#12141d] text-white transition-all duration-400 ease-out shadow-2xl',
          isExpanded ? 'w-64' : 'w-16'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className={cn(
          'flex h-16 items-center justify-between px-4 border-b border-white/10 transition-all duration-400',
          isExpanded ? 'px-4' : 'px-0'
        )}>
          {isExpanded && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left">
              <div className="rounded-lg bg-gradient-to-br from-red-500 to-red-600 p-1.5 shadow-lg">
                <Shield className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent">Admin</span>
            </div>
          )}
          {!isExpanded && (
            <div className="flex w-full justify-center">
              <div className="rounded-lg bg-gradient-to-br from-red-500 to-red-600 p-1.5 shadow-lg">
                <Shield className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          <TooltipProvider delayDuration={0}>
            {adminMenuItems.map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'menu-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300',
                        isActive
                          ? 'active bg-gradient-to-r from-red-500/15 to-transparent text-red-300 shadow-md'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                        'relative overflow-hidden group'
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                      <item.Icon className={cn(
                        'h-5 w-5 flex-shrink-0 transition-all duration-300',
                        isActive && 'text-red-400'
                      )} />
                      {isExpanded && <span className="relative z-10">{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {!isExpanded && (
                    <TooltipContent side="right" className="bg-gray-900 text-white border-gray-700 font-medium">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 space-y-3">
          <div className={cn(
            'user-section flex items-center gap-3 rounded-lg bg-gradient-to-r from-red-500/10 to-transparent p-3 backdrop-blur-sm border border-red-500/20',
            'transition-all duration-300 hover:bg-red-500/15 hover:border-red-500/40'
          )}>
            <Avatar className="h-8 w-8 ring-2 ring-red-500/30">
              <AvatarFallback className="bg-gradient-to-br from-red-500 to-red-600 text-white font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            {isExpanded && (
              <div className="min-w-0 flex-1 animate-in fade-in slide-in-from-left">
                <p className="truncate text-sm font-semibold text-white">{getUserDisplayName()}</p>
                <p className="truncate text-xs text-gray-400">System Admin</p>
              </div>
            )}
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className={cn(
              'logout-btn w-full justify-start text-gray-400 hover:text-white transition-all duration-300',
              'hover:bg-red-500/10 active:scale-95'
            )}
          >
            <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
            {isExpanded && <span>Logout</span>}
          </Button>
        </div>

        {/* Collapse Button */}
        <div className="absolute -right-3 top-20 z-50">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'rounded-full bg-gray-800 p-1.5 shadow-lg hover:bg-gray-700 transition-all duration-300',
              'hover:scale-110 active:scale-95 border border-gray-700/50'
            )}
            style={{
              transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <ChevronLeft className="h-4 w-4 text-gray-300" />
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
