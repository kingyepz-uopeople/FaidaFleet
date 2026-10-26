'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * The one dialog pattern used for add / edit forms.
 *
 * Two bugs are fixed here for good:
 *
 * 1. The dialog is always rendered by the page itself, never inside the page
 *    header's action cluster. Radix treats the click that opened a dialog as an
 *    "interaction outside" when the trigger is re-rendered inside a flex
 *    container that changes height — the dialog opened and closed in the same
 *    tick.
 * 2. The first outside/focus interaction right after opening is ignored. This
 *    covers drop-down menu items (Edit in a row menu) whose click event is
 *    still being dispatched while the dialog mounts.
 *
 * Always use controlled state: `open={dialogOpen} onOpenChange={setDialogOpen}`
 * and a plain `<Button type="button" onClick={...}>` in the header. Do not put
 * a `DialogTrigger` inside `PageShell`/`AdminPageHeader` actions.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  preventDismiss,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  /** Keep the dialog open no matter where the user clicks (used for blocking flows). */
  preventDismiss?: boolean
}) {
  const openedAt = React.useRef(0)

  React.useEffect(() => {
    if (open) openedAt.current = Date.now()
  }, [open])

  const guard = React.useCallback(
    (event: Event) => {
      if (preventDismiss) {
        event.preventDefault()
        return
      }
      if (Date.now() - openedAt.current < 350) {
        event.preventDefault()
      }
    },
    [preventDismiss],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-[min(calc(100vw-1.5rem),32rem)] overflow-y-auto p-4 sm:p-6',
          className,
        )}
        onInteractOutside={guard}
        onPointerDownOutside={guard}
        onFocusOutside={guard}
        onEscapeKeyDown={(event) => {
          if (preventDismiss) event.preventDefault()
        }}
      >
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          {/* Always rendered: Radix warns in the console when a dialog has no
              description, and the hidden fallback keeps that warning away. */}
          <DialogDescription className={description ? undefined : 'sr-only'}>
            {description || title}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
