import {
  BarChart3,
  LayoutDashboard,
  Receipt,
  Settings,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
  Zap,
  CircleHelp,
} from '@/components/icons'

export const fleetMenuItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/vehicles', label: 'Vehicles', Icon: Truck },
  { href: '/drivers', label: 'Drivers', Icon: Users },
  { href: '/collections', label: 'Collections', Icon: Wallet },
  { href: '/expenses', label: 'Expenses', Icon: Receipt },
  { href: '/trips', label: 'Trips', Icon: Zap },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/maintenance', label: 'Maintenance', Icon: Wrench },
  { href: '/driver-analytics', label: 'Driver Stats', Icon: TrendingUp },
  { href: '/settings', label: 'Settings', Icon: Settings },
]

export const fleetHelpItem = { href: '/help', label: 'Help', Icon: CircleHelp }

export function bottomNavForRole(role: string) {
  if (role.toLowerCase() === 'driver') {
    return [
      fleetMenuItems[0],
      fleetMenuItems[3],
      fleetMenuItems[5],
      fleetMenuItems[4],
      fleetMenuItems[9],
    ]
  }
  return [
    fleetMenuItems[0],
    fleetMenuItems[1],
    fleetMenuItems[2],
    fleetMenuItems[3],
    fleetMenuItems[9],
  ]
}
