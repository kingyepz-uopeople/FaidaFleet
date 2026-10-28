'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AuthMobileScreen,
  AuthField,
  AuthSecondaryLink,
  AuthQuietLink,
  AuthPrefixChip,
} from '@/components/auth-mobile-screen'
import { Check, Phone, Lock, User, X, Shield } from '@/components/icons'
import { normalizeKenyanPhone, validatePin } from '@/lib/phone'

export default function SignUpPage() {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const pinsMatch = confirmPin.length > 0 && pin === confirmPin
  const pinsMismatch = confirmPin.length > 0 && pin !== confirmPin

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const normalized = normalizeKenyanPhone(phone)
    const pinError = validatePin(pin)
    if (!normalized) {
      setError('Enter a valid Kenyan phone number, for example 0712345678')
      setLoading(false)
      return
    }
    if (pinError) {
      setError(pinError)
      setLoading(false)
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match')
      setLoading(false)
      return
    }

    try {
      // The PIN goes to a server route: the password transform (and pepper)
      // must never be implemented in the browser.
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, pin, fullName }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.error || 'Could not create the account')
        return
      }

      setSuccess(true)
      router.push(payload.redirect || '/onboarding')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthMobileScreen
      heroTitle="Create your fleet"
      heroDescription="A Kenyan phone number and a 4 to 6 digit PIN."
      eyebrow="Create account"
      heroCompact
      title="Join FaidaFleet"
      description="Set up a fleet owner account in under a minute."
      onSubmit={handleSignUp}
      error={error}
      success={success ? 'Account created. Redirecting to set up your fleet...' : null}
      submitting={loading}
      submitDisabled={loading || success}
      submitLabel="Create account"
      pendingLabel="Creating account..."
      note="Your PIN is private — never share it"
      footer={
        <>
          <AuthSecondaryLink href="/login">Sign in instead</AuthSecondaryLink>
          <AuthQuietLink href="/admin-login" icon={Shield}>
            System administrator? Sign in with email
          </AuthQuietLink>
        </>
      }
    >
      <AuthField
        id="fullName"
        label="Full name"
        icon={User}
        type="text"
        autoComplete="name"
        placeholder="John Doe"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
        disabled={loading || success}
      />
      <AuthField
        id="phone"
        label="Phone number"
        icon={Phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoCapitalize="none"
        placeholder="0712 345 678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        labelAction={<AuthPrefixChip>+254 · Kenya</AuthPrefixChip>}
        required
        disabled={loading || success}
      />
      <AuthField
        id="pin"
        label="PIN"
        icon={Lock}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="new-password"
        placeholder="4 to 6 digits"
        maxLength={6}
        inputClassName="tracking-[0.25em] placeholder:tracking-normal"
        revealable
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        required
        disabled={loading || success}
      />
      <AuthField
        id="confirmPin"
        label="Confirm PIN"
        icon={Lock}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="new-password"
        placeholder="Repeat PIN"
        maxLength={6}
        inputClassName="tracking-[0.25em] placeholder:tracking-normal"
        revealable
        hint={
          confirmPin.length === 0 ? (
            'Re-enter your PIN.'
          ) : (
            <span
              role="status"
              aria-live="polite"
              className={
                pinsMatch
                  ? 'inline-flex items-center gap-1.5 font-semibold text-primary dark:text-sidebar-primary'
                  : 'inline-flex items-center gap-1.5 font-semibold text-destructive'
              }
            >
              {pinsMatch ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  PINs match
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5" />
                  PINs do not match
                </>
              )}
            </span>
          )
        }
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-invalid={pinsMismatch || undefined}
        required
        disabled={loading || success}
      />
    </AuthMobileScreen>
  )
}
