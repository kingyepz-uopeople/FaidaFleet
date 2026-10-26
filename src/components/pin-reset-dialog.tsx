'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from '@/components/icons'
import { PinReveal } from '@/components/pin-reveal'
import { validatePin } from '@/lib/phone'

type ResetPayload = {
  pin?: string
  generated: boolean
  created?: boolean
  phone?: string
  error?: string
  message?: string
}

export function PinResetDialog({
  open,
  onOpenChange,
  title,
  description,
  name,
  extraFields,
  submit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  name?: string
  extraFields?: ReactNode
  submit: (input: { pin?: string; generate: boolean }) => Promise<ResetPayload>
}) {
  const [mode, setMode] = useState<'generate' | 'custom'>('generate')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResetPayload | null>(null)

  const resetState = () => {
    setMode('generate')
    setPin('')
    setSubmitting(false)
    setError(null)
    setResult(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState()
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'custom') {
      const pinError = validatePin(pin)
      if (pinError) {
        setError(pinError)
        return
      }
    }
    setSubmitting(true)
    try {
      const payload = await submit(mode === 'custom' ? { pin, generate: false } : { generate: true })
      if (payload.error) {
        setError(payload.error)
        return
      }
      setResult(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the PIN')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {result?.pin ? (
          <div className="space-y-4">
            <PinReveal pin={result.pin} name={name} />
            <DialogFooter>
              <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {extraFields}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === 'generate' ? 'default' : 'outline'}
                className="min-h-11"
                onClick={() => setMode('generate')}
              >
                Random PIN
              </Button>
              <Button
                type="button"
                variant={mode === 'custom' ? 'default' : 'outline'}
                className="min-h-11"
                onClick={() => setMode('custom')}
              >
                Set PIN
              </Button>
            </div>
            {mode === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="reset-pin">New PIN</Label>
                <Input
                  id="reset-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  placeholder="4 to 6 digits"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The new PIN is shown once so you can tell the person. Existing PINs cannot be viewed.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => handleOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : mode === 'generate' ? (
                  'Generate PIN'
                ) : (
                  'Save PIN'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
