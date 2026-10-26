'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LogOut } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useSignOut } from '@/hooks/use-sign-out'

type SignOutButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string
  iconClassName?: string
  children?: ReactNode
}

/**
 * Radix `asChild` triggers (TooltipTrigger, DropdownMenuTrigger, ...) clone
 * their child and pass a ref plus event/data props. This trigger is a
 * forwardRef component that spreads every prop onto the native button so no
 * handler or ref is lost.
 */
export const SignOutButton = forwardRef<HTMLButtonElement, SignOutButtonProps>(
  function SignOutButton(
    { label = 'Sign out', iconClassName = 'h-4 w-4', className, children, onClick, ...props },
    ref,
  ) {
    const { signOut, signingOut } = useSignOut()

    return (
      <button
        {...props}
        ref={ref}
        type="button"
        disabled={signingOut || props.disabled}
        aria-label={props['aria-label'] || label}
        onClick={async (event) => {
          onClick?.(event)
          if (event.defaultPrevented) return
          await signOut()
        }}
        className={cn('inline-flex min-h-11 items-center justify-center gap-2', className)}
      >
        {children || (
          <>
            <LogOut className={iconClassName} />
            <span>{signingOut ? 'Signing out…' : label}</span>
          </>
        )}
      </button>
    )
  },
)
