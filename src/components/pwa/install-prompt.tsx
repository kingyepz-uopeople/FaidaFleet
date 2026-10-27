'use client'

import { useEffect, useState } from 'react'
import { Download, X } from '@/components/icons'
import {
  isInstallDismissed,
  needsIosInstallHint,
  rememberInstallDismissal,
  type DismissalStorage,
} from '@/lib/pwa/install-dismissal'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type PromptMode = 'none' | 'native' | 'ios'

function browserStorage(): DismissalStorage {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Compact in-flow install bar. It is rendered as a sibling of the scrolling
 * main, so it takes its own height instead of floating over page content or
 * the fixed bottom tab bar. UXWing icons are bare (no boxes/badges).
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<PromptMode>('none')
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isInstallDismissed(browserStorage())) return

    const standalone =
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    if (needsIosInstallHint(navigator.userAgent, standalone)) {
      setMode('ios')
      return
    }

    const handler = (event: Event) => {
      event.preventDefault()
      // A dismissal in another tab (or just now) must not resurrect the bar.
      if (isInstallDismissed(browserStorage())) return
      setPromptEvent(event as BeforeInstallPromptEvent)
      setMode('native')
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    rememberInstallDismissal(browserStorage())
    setPromptEvent(null)
    setMode('none')
  }

  const handleInstall = async () => {
    if (!promptEvent) return
    try {
      await promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted' || outcome === 'dismissed') dismiss()
    } catch {
      // A browser that cancels the prompt must not leave the bar stuck open.
      dismiss()
    }
  }

  if (mode === 'none') return null
  const isIos = mode === 'ios'

  return (
    <div
      role="region"
      aria-label="Install FaidaFleet"
      className="shrink-0 border-t border-[#1e3a5f]/20 bg-[#1e3a5f] px-3 py-1.5 text-white sm:px-4"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
        <Download className="h-5 w-5 shrink-0 text-white/80" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold sm:text-sm">Install FaidaFleet</p>
          <p className="truncate text-[11px] text-white/70 sm:text-xs">
            {isIos
              ? 'Tap Share → Add to Home Screen for offline access'
              : 'Works offline from your home screen'}
          </p>
        </div>
        {!isIos && (
          <button
            type="button"
            onClick={handleInstall}
            className="min-h-11 shrink-0 rounded-full bg-white px-3 text-xs font-semibold text-[#1e3a5f] transition-colors hover:bg-white/90"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white"
          aria-label="Dismiss install banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
