'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthMobileScreen, AuthField, AuthFooterLink } from '@/components/auth-mobile-screen'
import { Phone, Lock, User } from '@/components/icons'
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
      heroDescription="A Kenyan phone number and a 4 to 6 digit PIN. That PIN is how you sign in."
      title="Join FaidaFleet"
      description="Create a fleet owner account with your phone number and a PIN."
      onSubmit={handleSignUp}
      error={error}
      success={success ? 'Account created successfully! Redirecting to set up your fleet...' : null}
      submitting={loading}
      submitDisabled={loading || success}
      submitLabel="Create account"
      pendingLabel="Creating account..."
      footer={
        <AuthFooterLink prompt="Already have an account?" href="/login">
          Sign in
        </AuthFooterLink>
      }
    >
      <AuthField
        id="fullName"
        label="Full Name"
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
        placeholder="0712345678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        disabled={loading || success}
      />
      <AuthField
        id="pin"
        label="PIN"
        icon={Lock}
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        placeholder="4 to 6 digits"
        maxLength={6}
        hint="Use 4 to 6 digits. This PIN is how you sign in."
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
        autoComplete="new-password"
        placeholder="Repeat PIN"
        maxLength={6}
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        required
        disabled={loading || success}
      />
    </AuthMobileScreen>
  )
}
