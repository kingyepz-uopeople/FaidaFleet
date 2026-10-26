'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'faidafleet-pwa-install-dismissed'

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY)) return

    // Detect iOS
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua)
    const standalone = (navigator as any).standalone === true
    setIsIOS(ios)

    if (ios && !standalone) {
      setShowIOSHint(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!promptEvent) return
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      dismiss()
    }
  }

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShowBanner(false)
    setShowIOSHint(false)
  }

  if (showIOSHint) {
    return (
      <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 rounded-2xl bg-[#1e3a5f] text-white shadow-2xl p-4 flex items-start gap-3 max-w-sm mx-auto md:bottom-4">
        <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-lg font-bold">
          FF
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install FaidaFleet</p>
          <p className="text-xs text-white/70 mt-0.5">
            Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span>
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center text-white/60 hover:text-white transition-colors text-xl leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    )
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 rounded-2xl bg-[#1e3a5f] text-white shadow-2xl p-4 flex items-center gap-3 max-w-sm mx-auto md:bottom-4">
      <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-lg font-bold">
        FF
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install FaidaFleet</p>
        <p className="text-xs text-white/70">Access your fleet offline, anytime</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={handleInstall}
          className="min-h-11 rounded-full bg-white px-3 text-xs font-semibold text-[#1e3a5f] hover:bg-white/90 transition-colors"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          className="text-white/60 hover:text-white transition-colors text-xl leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}
