'use client'

import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Check, Copy } from '@/components/icons'

export function PinReveal({
  pin,
  name,
}: {
  pin: string
  name?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pin)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50">
      <AlertDescription className="space-y-3">
        <p className="text-sm font-medium">
          {name ? `New PIN for ${name}` : 'New PIN'} — shown once. Copy it now and send it on WhatsApp. It cannot be viewed again.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-white px-3 py-3 text-center text-2xl font-semibold tracking-[0.35em] text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-50">
            {pin}
          </code>
          <Button type="button" variant="outline" className="h-11 min-w-11 px-3" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only sm:not-sr-only sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
