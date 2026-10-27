'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * One working sign-out for the sidebar, the mobile menu, the header and the
 * mandatory PIN dialog. Signing out must always be possible, even when a modal
 * blocks the rest of the screen.
 */
export function useSignOut() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) console.error('Sign out failed:', error.message)
    } finally {
      // Always leave the blocked screen, even if the network call fails.
      router.replace('/login')
      router.refresh()
      setSigningOut(false)
    }
  }, [router, signingOut])

  return { signOut, signingOut }
}
