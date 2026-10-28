'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AuthMobileScreen,
  AuthField,
  AuthSecondaryLink,
  AuthQuietLink,
  AuthDisclosure,
  AuthPrefixChip,
} from '@/components/auth-mobile-screen'
import { Phone, Lock, Plus, Shield } from '@/components/icons'
import { normalizeKenyanPhone, validatePin } from '@/lib/phone'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

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

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, pin }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.error || 'Phone number or PIN is incorrect')
        return
      }
      router.push(payload.redirect || '/dashboard')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthMobileScreen
      heroTitle="Fleet money, on every phone."
      heroDescription="Collections, trips and drivers for Kenyan fleets."
      eyebrow="Sign in"
      title="Welcome back"
      description="Sign in with your phone number and PIN."
      onSubmit={handleLogin}
      error={error}
      submitting={loading}
      submitLabel="Sign in"
      pendingLabel="Signing in..."
      note="Secure sign in · phone and PIN"
      footer={
        <>
          <AuthSecondaryLink href="/signup" icon={Plus}>
            Create an account
          </AuthSecondaryLink>
          <AuthQuietLink href="/admin-login" icon={Shield}>
            System administrator? Sign in with email
          </AuthQuietLink>
        </>
      }
    >
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
        disabled={loading}
      />
      <AuthField
        id="pin"
        label="PIN"
        icon={Lock}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="current-password"
        placeholder="4 to 6 digits"
        maxLength={6}
        inputClassName="tracking-[0.25em] placeholder:tracking-normal"
        revealable
        hint="4 to 6 digits. Tap the eye to check what you typed."
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        required
        disabled={loading}
      />
      <AuthDisclosure summary="Forgot PIN? Get help">
        A system administrator can reset your PIN. Fleet owners can also reset a driver&apos;s PIN
        from the driver record, and anyone already signed in can change their own PIN in Settings.
      </AuthDisclosure>
    </AuthMobileScreen>
  )
}
