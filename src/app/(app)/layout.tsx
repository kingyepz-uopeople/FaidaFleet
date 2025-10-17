'use client';

import React from 'react';
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
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppHeader } from '@/components/app-header';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/vehicles', label: 'Vehicles', Icon: Truck },
  { href: '/drivers', label: 'Drivers', Icon: Users },
  { href: '/collections', label: 'Collections', Icon: Wallet },
  { href: '/expenses', label: 'Expenses', Icon: Receipt },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sidebar-primary transition-colors hover:text-sidebar-primary-foreground"
          >
            <Car className="h-8 w-8" />
            <span className="text-xl font-semibold">FaidaFleet</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map(({ href, label, Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(href)}
                  tooltip={{ children: label, className: 'bg-sidebar-background text-sidebar-foreground border-sidebar-border' }}
                >
                  <Link href={href}>
                    <Icon />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <SidebarMenu>
             <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={{ children: "Help & Support", className: 'bg-sidebar-background text-sidebar-foreground border-sidebar-border' }}
                >
                  <Link href="#">
                    <CircleHelp />
                    <span>Help & Support</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/settings">
                  <div className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent">
                     <Avatar className="h-8 w-8">
                       <AvatarImage src={PlaceHolderImages[0].imageUrl} data-ai-hint="man portrait"/>
                       <AvatarFallback>JD</AvatarFallback>
                     </Avatar>
                     <div className="flex flex-col text-sm">
                       <span className="font-medium text-sidebar-foreground">John Kamau</span>
                       <span className="text-xs text-muted-foreground">Owner</span>
                     </div>
                  </div>
                 </Link>
              </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
