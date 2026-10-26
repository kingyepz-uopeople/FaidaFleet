'use client'

import { useEffect } from 'react'

/**
 * Registers the FaidaFleet service worker (/sw.js) for offline support.
 * Runs in production builds only, after the page has loaded, so it never
 * competes with first paint or interferes with local development.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((error) => {
          console.error('Service worker registration failed:', error)
        })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }

    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
