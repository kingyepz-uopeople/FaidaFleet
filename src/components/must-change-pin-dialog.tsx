'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from '@/components/icons'
import { validatePin } from '@/lib/phone'
import { needsPinChange } from '@/lib/pin'
import { SignOutButton } from '@/components/sign-out-button'
import { useFleetAccess } from '@/components/fleet-access-provider'

type PinPayload = { error?: string; ok?: boolean; mustChangePin?: boolean }

export function MustChangePinDialog() {
  const router = useRouter()
  const { refresh } = useFleetAccess()
  const [open, setOpen] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setOpen(needsPinChange(user))
    }
    check()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setOpen(needsPinChange(session?.user))
    })
    return () => subscription.unsubscribe()
  }, [])

  const clearForm = useCallback(() => {
    setCurrentPin('')
    setPin('')
    setConfirm('')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    for (const [label, value] of [['Current', currentPin], ['New', pin], ['Confirm', confirm]] as const) {
      const pinError = validatePin(value)
      if (pinError) {
        setError(`${label} PIN: ${pinError}`)
        return
      }
    }
    if (pin !== confirm) {
      setError('PINs do not match')
      return
    }

    setSaving(true)
    try {
      // The password transform and must_change_pin clearing happen on the
      // server. No browser call to supabase.auth.updateUser with a raw PIN.
      const response = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin: pin, confirmPin: confirm }),
      })
      const payload: PinPayload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Could not save your PIN')
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (needsPinChange(user)) {
        setError('Your PIN was saved, but the prompt did not clear. Sign out and sign in again.')
        return
      }
      setOpen(false)
      clearForm()
      // Keep the layout guard in sync: it must stop redirecting to /settings.
      await refresh()
      router.refresh()
    } catch {
      setError('Could not save your PIN. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 6)

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-[min(calc(100vw-1.5rem),28rem)] overflow-y-auto p-4 [&>button]:hidden sm:p-6"
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Set your own PIN</DialogTitle>
          <DialogDescription>
            Choose a new 4 to 6 digit PIN. Enter the PIN you just signed in with, then your new PIN twice. You can sign out at any time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="current-pin">Current PIN</Label>
            <Input
              id="current-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              className="h-12 text-base"
              value={currentPin}
              onChange={(e) => setCurrentPin(digitsOnly(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-pin">New PIN</Label>
            <Input
              id="first-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              className="h-12 text-base"
              value={pin}
              onChange={(e) => setPin(digitsOnly(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-pin-confirm">Confirm new PIN</Label>
            <Input
              id="first-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              className="h-12 text-base"
              value={confirm}
              onChange={(e) => setConfirm(digitsOnly(e.target.value))}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Pick something different from your current PIN. Forgot it later? Ask your administrator to reset it.
          </p>
          <Button type="submit" className="min-h-12 w-full text-base" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save PIN and continue'
            )}
          </Button>
          <SignOutButton
            label="Sign out"
            className="w-full rounded-xl border border-input text-sm font-medium hover:bg-muted"
            disabled={saving}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
