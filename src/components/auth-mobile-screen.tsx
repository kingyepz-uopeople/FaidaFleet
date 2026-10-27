'use client'

import type {
  ComponentProps,
  ComponentType,
  FormEventHandler,
  InputHTMLAttributes,
  ReactNode,
} from 'react'
import Link from 'next/link'
import { Car, CheckCircle2, Loader2, type IconProps } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import styles from './auth-mobile-screen.module.css'

const authLinkClassName =
  'inline-flex min-h-11 items-center justify-center rounded-md px-1 align-middle text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card'

export function AuthLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn(authLinkClassName, className)} {...props} />
}

type AuthFooterLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  prompt: string
}

export function AuthFooterLink({ prompt, ...linkProps }: AuthFooterLinkProps) {
  return (
    <p className="flex min-h-11 flex-wrap items-center justify-center gap-x-1 text-center text-sm text-muted-foreground">
      <span>{prompt}</span>
      <AuthLink {...linkProps} />
    </p>
  )
}

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> & {
  id: string
  label: string
  icon: ComponentType<IconProps>
  hint?: ReactNode
  labelAction?: ReactNode
}

export function AuthField({
  id,
  label,
  icon: Icon,
  hint,
  labelAction,
  ...inputProps
}: AuthFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </Label>
        {labelAction}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          className="h-12 min-h-12 rounded-xl border-foreground/20 bg-background pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60 md:text-base"
          aria-describedby={hintId}
          {...inputProps}
        />
      </div>
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

type AuthMobileScreenProps = {
  heroTitle: string
  heroDescription: string
  title: string
  description: string
  onSubmit: FormEventHandler<HTMLFormElement>
  error?: string | null
  success?: string | null
  submitting: boolean
  submitDisabled?: boolean
  submitLabel: string
  pendingLabel: string
  footer: ReactNode
  children: ReactNode
}

export function AuthMobileScreen({
  heroTitle,
  heroDescription,
  title,
  description,
  onSubmit,
  error,
  success,
  submitting,
  submitDisabled = submitting,
  submitLabel,
  pendingLabel,
  footer,
  children,
}: AuthMobileScreenProps) {
  return (
    <div
      data-auth-mobile-screen=""
      className="flex min-h-dvh w-full items-start justify-center bg-background sm:bg-sidebar/5 sm:px-6 sm:py-8"
    >
      <main
        className={cn(
          styles.screen,
          'flex min-h-dvh w-full max-w-[420px] flex-col border-x border-border bg-card text-card-foreground sm:min-h-[calc(100dvh_-_4rem)] sm:rounded-[2rem] sm:border sm:shadow-2xl'
        )}
      >
        <header
          className={cn(
            styles.gutter,
            styles.safeTop,
            'border-b border-sidebar-border bg-sidebar pb-5 text-sidebar-foreground sm:rounded-t-[2rem] sm:pb-7'
          )}
        >
          <div className="flex items-center gap-2.5">
            <Car className="h-6 w-6 text-sidebar-primary" />
            <span className="text-base font-semibold tracking-tight">FaidaFleet</span>
          </div>
          <div className="mt-4 h-1 w-10 rounded-full bg-sidebar-primary sm:mt-5" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:mt-4">{heroTitle}</h1>
          <p className="mt-1.5 text-sm leading-5 text-sidebar-foreground/80 sm:mt-2 sm:leading-6">{heroDescription}</p>
        </header>

        <div className={cn(styles.gutter, 'flex flex-1 flex-col bg-card pt-5 sm:pt-7')}>
          <div className="mb-5 sm:mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-card-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground sm:leading-6">{description}</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-1 flex-col">
            {(error || success) && (
              <div className="mb-5 space-y-3">
                {error && (
                  <Alert
                    variant="destructive"
                    className="border-destructive/60 bg-destructive/10 text-foreground dark:bg-destructive/20"
                  >
                    <AlertDescription className="font-medium">{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="border-primary/40 bg-primary/10 text-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription className="font-medium">{success}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="space-y-4 sm:space-y-5">{children}</div>

            <div className="mt-auto space-y-0.5 pt-5 text-center sm:space-y-1 sm:pt-6">{footer}</div>

            <div
              className={cn(
                styles.fullBleed,
                styles.safeBottom,
                'sticky bottom-0 z-10 mt-3 border-t border-border bg-card pt-3 sm:bottom-8 sm:mt-4 sm:rounded-b-[2rem]'
              )}
            >
              <Button
                type="submit"
                className="h-12 min-h-12 w-full rounded-xl text-base font-semibold shadow-sm"
                disabled={submitDisabled}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {pendingLabel}
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
