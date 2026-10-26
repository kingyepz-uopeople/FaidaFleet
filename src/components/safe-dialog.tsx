'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  type DialogContentProps,
  type DialogProps,
} from '@/components/ui/dialog'

/**
 * Controlled dialogs used by every CRUD screen.
 *
 * The add/edit buttons live in page headers; the same pointer gesture that
 * opens the dialog used to bubble to the freshly mounted overlay and Radix
 * treated it as an outside click, closing the dialog instantly. We always
 * control `open` from the page (no DialogTrigger inside a header) and
 * SafeDialogContent swallows outside interactions that arrive in the first
 * few hundred milliseconds after mount.
 */
export function SafeDialog(props: DialogProps) {
  return <Dialog {...props} />
}

type SafeDialogContentProps = DialogContentProps & {
  /** Milliseconds after mount during which outside interactions are ignored. */
  guardMs?: number
}

export function SafeDialogContent({
  onInteractOutside,
  guardMs = 350,
  ...props
}: SafeDialogContentProps) {
  const mountedAt = React.useRef<number>(0)

  React.useEffect(() => {
    mountedAt.current = Date.now()
  }, [])

  return (
    <DialogContent
      onInteractOutside={(event) => {
        if (Date.now() - mountedAt.current < guardMs) {
          event.preventDefault()
          return
        }
        onInteractOutside?.(event)
      }}
      {...props}
    />
  )
}
