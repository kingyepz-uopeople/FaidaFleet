'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthMobileScreen, AuthField, AuthFooterLink } from '@/components/auth-mobile-screen'
import { Phone, Lock } from '@/components/icons'
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
      heroDescription="Collections, trips, and drivers for matatu and logistics operators in Kenya."
      title="Welcome back"
      description="Fleet owners and drivers sign in with a phone number and PIN."
      onSubmit={handleLogin}
      error={error}
      submitting={loading}
      submitLabel="Sign in"
      pendingLabel="Signing in..."
      footer={
        <>
          <AuthFooterLink prompt="Don't have an account?" href="/signup">
            Sign up
          </AuthFooterLink>
          <AuthFooterLink prompt="System administrator?" href="/admin-login">
            Sign in with email
          </AuthFooterLink>
        </>
      }
    >
      <AuthField
        id="phone"
        label="Phone number"
        icon={Phone}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="0712345678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        disabled={loading}
      />
      <AuthField
        id="pin"
        label="PIN"
        icon={Lock}
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        placeholder="4 to 6 digits"
        maxLength={6}
        hint="Forgot your PIN? Ask a system administrator to reset it. Fleet owners can also reset a driver PIN from the driver record. Signed-in users can change their own PIN in Settings."
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        required
        disabled={loading}
      />
    </AuthMobileScreen>
  )
}
