import { cn } from '@/lib/utils'
import { AdminDeveloper, Car } from '@/components/icons'
import type { IconProps } from '@/components/icons'

/**
 * The single FaidaFleet car mark. Both the fleet app and the admin console
 * (sidebar, mobile sheet and /admin-login) render this exact component so the
 * brand can never drift between surfaces.
 */
export function BrandMark({
  className,
  iconClassName,
  tone = 'dark',
}: {
  className?: string
  iconClassName?: string
  /** dark = sits on the dark sidebar/sheet, light = sits on a light card */
  tone?: 'dark' | 'light'
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-primary p-1.5',
        tone === 'light' && 'bg-primary',
        className,
      )}
    >
      <Car className={cn('h-5 w-5 text-primary-foreground', iconClassName)} />
    </div>
  )
}

/**
 * The admin identity is always the UXWing "Administrator Developer" icon.
 * It renders the same way for the real signed-in admin and the UI preview,
 * so there is no separate code path that can fall back to initials.
 */
export function AdminAvatar({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground',
        className,
      )}
    >
      <AdminDeveloper className={cn('h-5 w-5', iconClassName)} />
    </span>
  )
}

/**
 * Admin display name: full_name from admin_users, then profiles, then the
 * email local part. Never initials.
 */
export function adminDisplayName(input: {
  email?: string | null
  adminFullName?: string | null
  profileFullName?: string | null
}): string {
  const fromAdmin = input.adminFullName?.trim()
  if (fromAdmin) return fromAdmin
  const fromProfile = input.profileFullName?.trim()
  if (fromProfile) return fromProfile
  const localPart = input.email?.trim().split('@')[0]
  if (localPart) return localPart
  return 'System admin'
}

export function AdminDeveloperIcon(props: IconProps) {
  return <AdminDeveloper {...props} />
}
