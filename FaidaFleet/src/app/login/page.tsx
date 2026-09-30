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
import { Loader2, Car, Phone, Lock, Sparkles, TrendingUp, Shield } from '@/components/icons'
import { friendlyAuthError, normalizeKenyanPhone, phoneAuthEmail, validatePin } from '@/lib/phone'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: phoneAuthEmail(normalized),
        password: pin,
      })

      if (signInError || !data.user) {
        setError(friendlyAuthError(signInError?.message || 'Phone number or PIN is incorrect'))
        setLoading(false)
        return
      }

      const { data: adminRows } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .limit(1)

      if (adminRows && adminRows.length > 0) {
        await supabase.auth.signOut()
        setError('System administrators sign in with email.')
        setLoading(false)
        return
      }

      const { data: memberships } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .limit(1)

      if (!memberships || memberships.length === 0) {
        if (data.user.user_metadata?.account_type === 'driver') {
          await supabase.auth.signOut()
          setError('Your fleet owner still needs to add this phone number to the fleet.')
          setLoading(false)
          return
        }
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-12 text-white flex-col justify-between relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Car className="h-8 w-8" />
            </div>
            <span className="text-3xl font-bold">FaidaFleet</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Manage Your Fleet<br />
            <span className="text-blue-200">With Confidence</span>
          </h1>
          <p className="text-xl text-blue-100 max-w-md">
            The complete solution for matatu and logistics fleet management in Kenya.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Track Performance</h3>
              <p className="text-blue-100 text-sm">Real-time insights into your fleet's profitability</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Secure & Reliable</h3>
              <p className="text-blue-100 text-sm">Bank-level security for your financial data</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Easy to Use</h3>
              <p className="text-blue-100 text-sm">Intuitive interface designed for fleet owners</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white">
          <CardHeader className="space-y-2 pb-6">
            <div className="flex lg:hidden items-center justify-center gap-2 mb-4">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Car className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FaidaFleet</span>
            </div>
            <CardTitle className="text-3xl font-bold text-center text-gray-900">
              Welcome back
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Fleet owners and drivers sign in with a phone number and PIN
            </CardDescription>
          </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Label htmlFor="phone" className="text-sm font-semibold text-gray-700">
                Phone number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0712345678"
                  className="pl-10 h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="pin" className="text-sm font-semibold text-gray-700">
                PIN
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="4 to 6 digits"
                  maxLength={6}
                  className="pl-10 h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">
                A fleet owner resets a forgotten PIN from the driver record. Drivers can also change their own PIN in Settings.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col space-y-4 pt-6 border-t border-gray-200">
          <p className="text-sm text-center w-full text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Sign up now
            </Link>
          </p>
          <p className="text-sm text-center w-full text-gray-600">
            System administrator?{' '}
            <Link href="/admin-login" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Sign in with email
            </Link>
          </p>
        </CardFooter>
        </Card>
      </div>
    </div>
  )
}
