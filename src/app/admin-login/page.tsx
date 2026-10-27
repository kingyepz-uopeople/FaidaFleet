'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  AuthMobileScreen,
  AuthField,
  AuthFooterLink,
  AuthLink,
} from '@/components/auth-mobile-screen'
import { Mail, Lock } from '@/components/icons'
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
      heroTitle="System administration"
      heroDescription="Email and password only. Fleet owners and drivers use phone + PIN."
      title="System admin"
      description="Sign in with the administrator email and password."
      onSubmit={handleLogin}
      error={error}
      submitting={loading}
      submitLabel="Sign in"
      pendingLabel="Signing in..."
      footer={
        <AuthFooterLink prompt="Fleet owner or driver?" href="/login">
          Sign in with phone and PIN
        </AuthFooterLink>
      }
    >
      <AuthField
        id="email"
        label="Email"
        icon={Mail}
        type="email"
        inputMode="email"
        autoComplete="username"
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
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading}
        labelAction={
          <AuthLink href="/reset-password" className="text-sm">
            Forgot password?
          </AuthLink>
        }
      />
    </AuthMobileScreen>
  )
}
