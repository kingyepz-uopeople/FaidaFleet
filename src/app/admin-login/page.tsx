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

      router.push('/admin')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white">
        <CardHeader className="space-y-2 pb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2 bg-red-600 rounded-xl">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">FaidaFleet</span>
          </div>
          <CardTitle className="text-3xl font-bold text-center text-gray-900">
            System admin
          </CardTitle>
          <CardDescription className="text-center text-gray-600">
            Sign in with the administrator email and password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@example.com"
                  className="pl-10 h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
                <Link href="/reset-password" className="text-sm text-red-600 hover:text-red-700 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="pl-10 h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-red-600 hover:bg-red-700" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-center w-full text-gray-600">
            Fleet owner or driver?{' '}
            <Link href="/login" className="text-red-600 hover:text-red-700 font-semibold">
              Sign in with phone and PIN
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
