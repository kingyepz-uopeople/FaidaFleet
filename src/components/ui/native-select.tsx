'use client'

import * as React from 'react'
import { ChevronDown } from '@/components/icons'
import { cn } from '@/lib/utils'

/**
 * Native `<select>` styled like the rest of the form controls.
 *
 * Radix Select renders a button instead of a real form control, so a
 * `required` Radix Select blocks native form submission on mobile browsers.
 * Forms in this app use this component whenever the value has to take part in
 * native validation / submission.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          'flex h-11 min-h-11 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
)
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }
