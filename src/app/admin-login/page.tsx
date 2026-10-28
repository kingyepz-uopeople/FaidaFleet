'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  AuthMobileScreen,
  AuthField,
  AuthSecondaryLink,
  AuthLink,
} from '@/components/auth-mobile-screen'
import { Mail, Lock, Phone } from '@/components/icons'
import { friendlyAuthError, isPhoneAuthEmail } from '@/lib/phone'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isPhoneAuthEmail(email.trim())) {
      setError('Fleet owners and drivers sign in with a phone number and PIN.')
      setLoading(false)
      return
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError || !data.user) {
        setError(friendlyAuthError(signInError?.message || 'Email or password is incorrect', 'email'))
        return
      }

      const { data: adminRows, error: adminError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .limit(1)

      if (adminError || !adminRows || adminRows.length === 0) {
        await supabase.auth.signOut()
        setError('This email is not a system administrator. Fleet owners and drivers sign in with a phone number and PIN.')
        return
      }

      void supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', data.user.id)

      router.push('/admin')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthMobileScreen
      variant="admin"
      heroTitle="System administration"
      heroDescription="Email and password for system administrators only."
      eyebrow="Restricted access"
      title="System admin"
      description="Sign in with your administrator email and password."
      onSubmit={handleLogin}
      error={error}
      submitting={loading}
      submitLabel="Sign in"
      pendingLabel="Signing in..."
      note="Admin activity is audited"
      footer={
        <AuthSecondaryLink href="/login" icon={Phone}>
          Fleet owner or driver? Sign in with phone and PIN
        </AuthSecondaryLink>
      }
    >
      <AuthField
        id="email"
        label="Email"
        icon={Mail}
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="admin@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
      />
      <AuthField
        id="password"
        label="Password"
        icon={Lock}
        type="password"
        autoComplete="current-password"
        placeholder="Your password"
        revealable
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading}
        labelAction={
          <AuthLink href="/reset-password" className="text-[13px] font-semibold">
            Forgot password?
          </AuthLink>
        }
      />
    </AuthMobileScreen>
  )
}
