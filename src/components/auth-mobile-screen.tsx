'use client'

import { useId, useState } from 'react'
import type {
  ComponentProps,
  ComponentType,
  FormEventHandler,
  InputHTMLAttributes,
  ReactNode,
} from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Shield,
  type IconProps,
} from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import styles from './auth-mobile-screen.module.css'

const authLinkClassName =
  'inline-flex min-h-11 items-center justify-center rounded-md px-1 align-middle text-sm font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:text-sidebar-primary'

export function AuthLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn(authLinkClassName, className)} {...props} />
}

/**
 * Small chip for the "Phone number" label row, e.g. "+254 · Kenya". It is a
 * label hint only: the input still accepts the number as the user dials it,
 * so phone normalisation stays exactly as it was.
 */
export function AuthPrefixChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary-foreground/80 dark:bg-white/10 dark:text-sidebar-foreground/80">
      {children}
    </span>
  )
}

/**
 * Outlined, full-width secondary action. 48px tall so it clears the 44px tap
 * target minimum on touch devices.
 */
export function AuthSecondaryLink({
  icon: Icon,
  children,
  ...props
}: ComponentProps<typeof Link> & { icon?: ComponentType<IconProps> }) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-12 min-h-12 w-full rounded-2xl border-[1.5px] border-border bg-card text-[15px] font-semibold text-foreground shadow-none transition-colors hover:bg-secondary hover:text-secondary-foreground dark:border-white/15 dark:bg-transparent dark:hover:bg-white/5"
    >
      <Link {...props}>
        {Icon && <Icon className="h-[18px] w-[18px]" />}
        {children}
      </Link>
    </Button>
  )
}

/** Quiet text action with a bare icon and a 44px tap target. */
export function AuthQuietLink({
  icon: Icon,
  children,
  ...props
}: ComponentProps<typeof Link> & { icon?: ComponentType<IconProps> }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-[13px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </Link>
  )
}

/**
 * Collapsed helper text. Keeps the visible form short on a phone while staying
 * keyboard and screen-reader accessible through native details/summary.
 */
export function AuthDisclosure({
  summary,
  children,
}: {
  summary: string
  children: ReactNode
}) {
  return (
    <details className="group rounded-2xl border border-border/80 bg-muted/50 px-3.5 py-2.5 text-muted-foreground transition-colors open:bg-muted/70 dark:border-white/10 dark:bg-white/5">
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <CircleHelp className="h-4 w-4 text-primary dark:text-sidebar-primary" />
          {summary}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="pb-1 pt-2 text-xs leading-5">{children}</div>
    </details>
  )
}

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> & {
  id: string
  label: string
  icon: ComponentType<IconProps>
  hint?: ReactNode
  labelAction?: ReactNode
  /** Extra classes for the input element itself (e.g. PIN letter spacing). */
  inputClassName?: string
  /** Adds a show/hide toggle. Only used for password and PIN inputs. */
  revealable?: boolean
}

export function AuthField({
  id,
  label,
  icon: Icon,
  hint,
  labelAction,
  inputClassName,
  revealable = false,
  type = 'text',
  disabled,
  ...inputProps
}: AuthFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const [revealed, setRevealed] = useState(false)
  const canReveal = revealable && type === 'password'

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[13px] font-semibold text-foreground">
          {label}
        </Label>
        {labelAction}
      </div>
      <div className="relative">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-primary dark:text-sidebar-primary"
        />
        <Input
          id={id}
          type={canReveal && revealed ? 'text' : type}
          disabled={disabled}
          className={cn(
            'h-[52px] min-h-[52px] w-full rounded-2xl border-[1.5px] border-muted-foreground/45 bg-white pl-11 text-base font-medium text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors placeholder:font-normal placeholder:text-muted-foreground/90 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 disabled:opacity-60 sm:h-14 sm:min-h-14 md:text-base dark:border-white/20 dark:bg-white/[0.06] dark:text-foreground dark:placeholder:text-muted-foreground dark:focus-visible:border-sidebar-primary dark:focus-visible:ring-sidebar-primary/35',
            canReveal ? 'pr-12' : 'pr-4',
            inputClassName
          )}
          aria-describedby={hintId}
          {...inputProps}
        />
        {canReveal && (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            disabled={disabled}
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={revealed}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-foreground"
          >
            {revealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className={cn(styles.hint, 'text-xs leading-5 text-muted-foreground')}>
          {hint}
        </p>
      )}
    </div>
  )
}

type AuthVariant = 'fleet' | 'admin'

const variants: Record<
  AuthVariant,
  {
    emblem: ComponentType<IconProps>
    /** Brand-token gradient for the hero. */
    hero: string
    glowPrimary: string
    glowSecondary: string
    tagline: string
    badge: string
  }
> = {
  fleet: {
    emblem: Car,
    hero: 'bg-gradient-to-br from-sidebar via-sidebar to-sidebar-accent',
    glowPrimary: 'bg-sidebar-primary/35',
    glowSecondary: 'bg-sidebar-accent/80',
    tagline: 'Fleet operations',
    badge: 'Kenya',
  },
  admin: {
    emblem: Shield,
    hero: 'bg-gradient-to-bl from-sidebar-accent via-sidebar to-sidebar',
    glowPrimary: 'bg-sidebar-accent/90',
    glowSecondary: 'bg-sidebar-primary/25',
    tagline: 'Admin console',
    badge: 'Staff only',
  },
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
  /** Secondary actions rendered directly under the primary button. */
  footer: ReactNode
  /** Reassurance line pinned to the bottom of the sheet. */
  note?: string
  children: ReactNode
  variant?: AuthVariant
  /** Small label above the form title, e.g. "Sign in". */
  eyebrow?: string
  /** Drops the hero tagline; used by screens with more fields to fill. */
  heroCompact?: boolean
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
  note = 'Secure sign in · phone and PIN only',
  children,
  variant = 'fleet',
  eyebrow,
  heroCompact = false,
}: AuthMobileScreenProps) {
  const palette = variants[variant]
  const Emblem = palette.emblem
  const heroHeadingId = useId()
  const formHeadingId = useId()

  return (
    <div
      className={cn(
        styles.viewport,
        'relative flex w-full items-start justify-center bg-background sm:px-6 sm:py-8'
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden sm:block"
        style={{
          background:
            'radial-gradient(110% 65% at 50% -10%, hsl(var(--sidebar-background) / 0.22), transparent 70%)',
        }}
      />

      <main
        className={cn(
          styles.screen,
          styles.rise,
          'relative flex min-h-dvh w-full max-w-[420px] flex-col bg-sidebar sm:min-h-[calc(100dvh_-_4rem)] sm:rounded-[2rem] sm:shadow-[0_30px_70px_-35px_rgba(15,23,42,0.55)]'
        )}
      >
        <header
          aria-labelledby={heroHeadingId}
          className={cn(
            styles.safeTop,
            styles.heroPad,
            'relative isolate shrink-0 overflow-hidden px-5 pb-16 text-sidebar-foreground sm:px-6 sm:pb-20'
          )}
        >
          <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10', palette.hero)}>
            <div
              className={cn(
                'absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl',
                palette.glowPrimary
              )}
            />
            <div
              className={cn(
                'absolute -bottom-24 -left-20 h-52 w-52 rounded-full blur-3xl',
                palette.glowSecondary
              )}
            />
            <div
              className="absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
                backgroundSize: '18px 18px',
                backgroundPosition: '-9px -9px',
              }}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <Emblem className="h-9 w-9 text-sidebar-primary sm:h-10 sm:w-10" />
            <span className="text-[22px] font-semibold tracking-tight text-white sm:text-2xl">
              FaidaFleet
            </span>
            <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/85 ring-1 ring-inset ring-white/20">
              {palette.badge}
            </span>
          </div>

          <p
            className={cn(
              styles.heroTagline,
              heroCompact && 'hidden',
              'mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-primary/90'
            )}
          >
            {palette.tagline}
          </p>

          <h1
            id={heroHeadingId}
            className={cn(
              styles.heroTitle,
              heroCompact && 'mt-1 sm:mt-1.5 sm:text-[24px]',
              'mt-1 text-[22px] font-semibold leading-[1.15] tracking-tight text-white sm:mt-2 sm:text-[27px]'
            )}
          >
            {heroTitle}
          </h1>
          <p
            className={cn(
              styles.heroDesc,
              'mt-1 max-w-[32ch] text-[13px] leading-5 text-sidebar-foreground/75 sm:mt-1.5 sm:text-sm sm:leading-6'
            )}
          >
            {heroDescription}
          </p>
        </header>

        <div
          className={cn(
            styles.gutter,
            styles.sheetPad,
            'relative -mt-10 flex flex-1 shrink-0 flex-col rounded-t-[28px] bg-card pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-18px_40px_-28px_rgba(2,6,23,0.8)] dark:border-t dark:border-white/10'
          )}
        >
          {/* my-auto (not justify-center) so overflowing content can still scroll to the top */}
          <div className="my-auto flex w-full flex-col">
            <div className={cn(styles.titleBlock, 'mb-4')}>
              {eyebrow && (
                <p
                  className={cn(
                    styles.formEyebrow,
                    'text-[11px] font-semibold uppercase tracking-[0.14em] text-primary dark:text-sidebar-primary'
                  )}
                >
                  {eyebrow}
                </p>
              )}
              <h2
                id={formHeadingId}
                className={cn(
                  'text-[21px] font-semibold tracking-tight text-card-foreground sm:text-[23px]',
                  eyebrow && 'mt-1'
                )}
              >
                {title}
              </h2>
              <p
                className={cn(
                  styles.formDesc,
                  'mt-1 text-[13px] leading-5 text-muted-foreground sm:text-sm sm:leading-6'
                )}
              >
                {description}
              </p>
            </div>

            <form
              onSubmit={onSubmit}
              aria-labelledby={formHeadingId}
              aria-busy={submitting}
              className="flex flex-col"
            >
              {(error || success) && (
                <div className="mb-4 space-y-2">
                  {error && (
                    <Alert
                      variant="destructive"
                      className="rounded-xl border-destructive/40 bg-destructive/[0.07] px-3.5 py-3 text-foreground [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-destructive [&>svg~*]:pl-6 dark:bg-destructive/20"
                    >
                      <AlertTriangle />
                      <AlertDescription className="text-[13px] font-medium leading-5">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <div aria-live="polite">
                      <Alert className="rounded-xl border-primary/30 bg-primary/[0.07] px-3.5 py-3 text-foreground [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-primary [&>svg~*]:pl-6 dark:bg-primary/15">
                        <CheckCircle2 />
                        <AlertDescription className="text-[13px] font-medium leading-5">
                          {success}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              )}

              <div className={cn(styles.fieldStack, 'flex flex-col gap-3.5')}>{children}</div>

              <Button
                type="submit"
                className={cn(
                  styles.cta,
                  'mt-5 h-14 min-h-14 w-full rounded-2xl text-base font-semibold shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.9)] transition-[transform,background-color] duration-150 active:scale-[0.99] disabled:shadow-none'
                )}
                disabled={submitDisabled}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {pendingLabel}
                  </>
                ) : (
                  <>
                    {submitLabel}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="mt-3 space-y-1.5">{footer}</div>
            </form>
          </div>

          <p
            className={cn(
              styles.note,
              'flex items-center justify-center gap-1.5 pb-1 pt-6 text-[11px] font-medium tracking-[0.02em] text-muted-foreground/90'
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            {note}
          </p>
        </div>
      </main>
    </div>
  )
}
