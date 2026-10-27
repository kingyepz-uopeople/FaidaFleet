import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Car,
  CircleHelp,
  DollarSign,
  KeyRound,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
  Wrench,
  Zap,
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

/** Drivers only get their own records and data entry. No finances or roster. */
export const driverMenuItems = [
  { href: '/trips', label: 'Trips', Icon: Zap },
  { href: '/collections', label: 'Collections', Icon: Wallet },
  { href: '/expenses', label: 'Expenses', Icon: Receipt },
  { href: '/expenses?new=fuel', label: 'Log fuel', Icon: DollarSign },
  { href: '/maintenance', label: 'Maintenance', Icon: Wrench },
  { href: '/settings', label: 'Settings', Icon: Settings },
]

export function fleetMenuForRole(role: string | null | undefined) {
  return (role || '').toLowerCase() === 'driver' ? driverMenuItems : fleetMenuItems
}

export const fleetHelpItem = { href: '/help', label: 'Help', Icon: CircleHelp }

export const adminNavGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Overview', Icon: LayoutDashboard },
      { href: '/admin/analytics', label: 'Analytics', Icon: TrendingUp },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/collections', label: 'Collections', Icon: Wallet },
      { href: '/admin/billing', label: 'Billing', Icon: BarChart3 },
      { href: '/admin/compliance', label: 'Compliance', Icon: AlertTriangle },
    ],
  },
  {
    label: 'Directory',
    items: [
      { href: '/admin/fleet-owners', label: 'Fleet owners', Icon: Users },
      { href: '/admin/drivers', label: 'Drivers', Icon: Car },
    ],
  },
  {
    label: 'Access',
    items: [
      { href: '/admin/users', label: 'Admin users', Icon: User },
      { href: '/admin/pin-resets', label: 'PIN resets', Icon: KeyRound },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/admin/plans', label: 'Plans', Icon: Package },
      { href: '/admin/settings', label: 'Settings', Icon: Settings },
      { href: '/admin/support', label: 'Support', Icon: AlertCircle },
    ],
  },
] as const

export function adminPageMeta(pathname: string) {
  for (const group of adminNavGroups) {
    for (const item of group.items) {
      if (item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item
      }
    }
  }
  return { href: '/admin', label: 'Admin', Icon: LayoutDashboard }
}

export function isAdminNavActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`)
}

export function bottomNavForRole(role: string) {
  if (role.toLowerCase() === 'driver') {
    return [
      driverMenuItems[0], // Trips
      driverMenuItems[1], // Collections
      driverMenuItems[2], // Expenses
      driverMenuItems[3], // Log fuel (opens the fuel expense form)
      driverMenuItems[4], // Maintenance
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
