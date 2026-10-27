/** Small, testable pieces of the PWA install banner's dismissal state. */

export const INSTALL_DISMISS_STORAGE_KEY = 'faidafleet-pwa-install-dismissed'

export type DismissalStorage = Pick<Storage, 'getItem' | 'setItem'> | null | undefined

/** Private browsing and locked-down WebViews can throw on localStorage access. */
export function isInstallDismissed(storage: DismissalStorage): boolean {
  try {
    return storage?.getItem(INSTALL_DISMISS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberInstallDismissal(storage: DismissalStorage): void {
  try {
    storage?.setItem(INSTALL_DISMISS_STORAGE_KEY, '1')
  } catch {
    // Dismissal still hides the banner for this page view even if storage is
    // unavailable; the component keeps its own state as a fallback.
  }
}

/** iOS Safari has no beforeinstallprompt event, so it gets a short hint. */
export function needsIosInstallHint(userAgent: string, standalone: boolean): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) && !standalone
}
