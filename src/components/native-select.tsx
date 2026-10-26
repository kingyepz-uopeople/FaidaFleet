'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Native <select> styling shared by every form. Radix Select renders a
 * custom button that does not participate in native form validation, so a
 * required Radix field silently blocked submit on mobile. The native control
 * validates, works with keyboards and screen readers, and matches Input.
 */
export const nativeSelectClass =
  'flex h-11 min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(nativeSelectClass, className)} {...props}>
      {children}
    </select>
  ),
)
NativeSelect.displayName = 'NativeSelect'
