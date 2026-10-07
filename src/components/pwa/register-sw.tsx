'use client'

import { useEffect } from 'react'

export function RegisterSW() {
  useEffect(() => {
    // Register in production only
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        console.log('[FaidaFleet SW] Registered:', reg.scope)
      } catch (err) {
        console.error('[FaidaFleet SW] Registration failed:', err)
      }
    }

    register()
  }, [])

  return null
}
