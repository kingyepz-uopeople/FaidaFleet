'use client'

import { useEffect, useState } from 'react'
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
import { friendlyAuthError, validatePin } from '@/lib/phone'
import { MUST_CHANGE_PIN_KEY, needsPinChange } from '@/lib/pin'

export function MustChangePinDialog() {
  const [open, setOpen] = useState(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const pinError = validatePin(pin)
    if (pinError) {
      setError(pinError)
      return
    }
    if (pin !== confirm) {
      setError('PINs do not match')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password: pin,
        data: { [MUST_CHANGE_PIN_KEY]: false },
      })
      if (updateError) throw new Error(friendlyAuthError(updateError.message))
      setOpen(false)
      setPin('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Set your PIN</DialogTitle>
          <DialogDescription>
            Choose a 4 to 6 digit PIN for this phone number. You will use it to sign in. If you forget it later, ask a system administrator to reset it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="first-pin">New PIN</Label>
            <Input
              id="first-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-pin-confirm">Confirm PIN</Label>
            <Input
              id="first-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </div>
          <Button type="submit" className="min-h-11 w-full" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save PIN'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
