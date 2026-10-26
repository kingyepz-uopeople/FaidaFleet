'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, Mail, Lock } from '@/components/icons'
import { friendlyAuthError, isPhoneAuthEmail } from '@/lib/phone'
import { AuthShell } from '@/components/auth-shell'

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
    <AuthShell variant="admin" headline="System administration" subhead="Email and password only. Fleet owners and drivers use phone + PIN.">
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <div className="mb-2 flex items-center justify-center gap-2">
            <div className="rounded-xl bg-rose-600 p-2">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-semibold">FaidaFleet</span>
          </div>
          <CardTitle className="text-center text-2xl">System admin</CardTitle>
          <CardDescription className="text-center">
            Sign in with the administrator email and password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@example.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <Link href="/reset-password" className="text-sm font-medium text-rose-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-sm text-muted-foreground">
            Fleet owner or driver?{' '}
            <Link href="/login" className="font-semibold text-rose-700">Sign in with phone and PIN</Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  )
}
