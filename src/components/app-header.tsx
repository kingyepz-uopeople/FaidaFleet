"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Menu, Settings, User as UserIcon } from '@/components/icons';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { accountContact, accountInitials, accountLabel } from '@/lib/phone';
import { createClient } from '@/lib/supabase/client';
import { useSignOut } from '@/hooks/use-sign-out';
import type { User } from '@supabase/supabase-js';

function getTitleFromPathname(pathname: string): string {
  const segment = pathname.split('/').pop() || 'dashboard';
  if (segment === 'dashboard') return 'Dashboard';
  if (segment === 'driver-analytics') return 'Driver stats';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function AppHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = getTitleFromPathname(pathname);
  const supabase = createClient();
  const { signOut } = useSignOut();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur sm:h-16 sm:px-6 pt-[env(safe-area-inset-top)]">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.user_metadata?.avatar_url || PlaceHolderImages[0].imageUrl} alt="User Avatar" />
                <AvatarFallback>{accountInitials(user)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{accountLabel(user)}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {accountContact(user) || 'Phone sign-in'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <UserIcon />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
