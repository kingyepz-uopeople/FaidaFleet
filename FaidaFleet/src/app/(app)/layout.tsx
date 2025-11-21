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

  const isExpanded = !isCollapsed || isHovered;

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: membership } = await supabase
          .from('memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (membership) {
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
        .menu-item:nth-child(4) { animation-delay: 0.2s; }
        .menu-item:nth-child(5) { animation-delay: 0.25s; }
        .menu-item:nth-child(6) { animation-delay: 0.3s; }

        .menu-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 24px;
          background: linear-gradient(to bottom, rgb(59, 130, 246), rgb(37, 99, 235));
          border-radius: 0 2px 2px 0;
          animation: activeIndicator 0.3s ease-out;
        }

        .user-section {
          animation: slideInUp 0.5s ease-out;
        }

        .help-support {
          animation: slideInUp 0.55s ease-out;
        }

        .theme-toggle {
          animation: slideInUp 0.6s ease-out;
        }

        .nav-item {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .nav-item:hover {
          transform: translateX(4px);
        }
      `}</style>

      {/* Collapsible Sidebar */}
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
            <Link href="/dashboard" className="flex items-center gap-3 transition-all hover:opacity-80 group">
              <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-1.5 shadow-lg group-hover:shadow-blue-500/50 transition-all">
                <Car className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">FaidaFleet</span>
            </Link>
          )}
          {!isExpanded && (
            <Link href="/dashboard" className="flex w-full justify-center group transition-all">
              <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-1.5 shadow-lg group-hover:shadow-blue-500/50 transition-all">
                <Car className="h-5 w-5" />
              </div>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          <TooltipProvider delayDuration={0}>
            {menuItems.map(({ href, label, Icon }, index) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className={cn(
                        'nav-item menu-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300',
                        isActive
                          ? 'active bg-gradient-to-r from-blue-500/15 to-transparent text-blue-300 shadow-md'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                        'relative overflow-hidden group'
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                      <Icon className={cn(
                        'h-5 w-5 flex-shrink-0 transition-all duration-300',
                        isActive && 'text-blue-400'
                      )} />
                      {isExpanded && <span className="relative z-10">{label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {!isExpanded && (
                    <TooltipContent side="right" className="bg-gray-900 text-white border-gray-700 font-medium">
                      {label}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 space-y-3 p-3">
          {/* Help & Support */}
          <div className="help-support">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/help"
                    className={cn(
                      'nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-all duration-300',
                      'hover:text-gray-200 hover:bg-white/5 relative overflow-hidden group',
                      !isExpanded && 'justify-center'
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                    <CircleHelp className="h-5 w-5 flex-shrink-0" />
                    {isExpanded && <span className="relative z-10">Help & Support</span>}
                  </Link>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="bg-gray-900 text-white border-gray-700 font-medium">
                    Help & Support
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* User Profile */}
          <div className="user-section">
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 rounded-lg p-2.5 transition-all duration-300 group',
                'hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-transparent',
                !isExpanded && 'justify-center'
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-blue-500/30 group-hover:ring-blue-500/50 transition-all">
                <AvatarImage src={user?.user_metadata?.avatar_url || PlaceHolderImages[0].imageUrl} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              {isExpanded && (
                <div className="flex flex-col overflow-hidden min-w-0 flex-1 animate-in fade-in slide-in-from-left">
                  <span className="truncate text-sm font-semibold text-white">{getUserDisplayName()}</span>
                  <span className="truncate text-xs text-gray-400">{userRole}</span>
                </div>
              )}
            </Link>
          </div>

          {/* Theme Toggle */}
          <div className="theme-toggle">
            <div className={cn(
              'flex items-center gap-1.5 rounded-lg bg-white/5 backdrop-blur-sm p-1 border border-white/10',
              'hover:bg-white/10 transition-all duration-300',
              !isExpanded && 'justify-center'
            )}>
              {isExpanded ? (
                <>
                  <button
                    onClick={() => setIsDark(true)}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-300',
                      'hover:scale-105 active:scale-95',
                      isDark 
                        ? 'bg-gradient-to-r from-blue-500/20 to-blue-400/10 text-blue-300 shadow-md' 
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    <Moon className="mx-auto h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIsDark(false)}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-300',
                      'hover:scale-105 active:scale-95',
                      !isDark 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-400/10 text-yellow-300 shadow-md' 
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    <Sun className="mx-auto h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="flex-1 rounded-md p-1.5 text-gray-400 transition-all hover:text-white hover:bg-white/10 hover:scale-105 active:scale-95"
                >
                  {isDark ? <Moon className="mx-auto h-4 w-4" /> : <Sun className="mx-auto h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full',
            'border border-blue-500/30 bg-[#1a1d29] text-gray-400 transition-all duration-300',
            'hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/50 hover:scale-110 active:scale-95',
            'shadow-lg hover:shadow-blue-500/30'
          )}
          style={{
            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
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
