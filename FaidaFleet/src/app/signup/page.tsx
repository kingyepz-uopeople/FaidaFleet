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
import { Loader2, Car, Phone, Lock, User, CheckCircle2, Sparkles, Users, BarChart3, Shield } from '@/components/icons'
import { friendlyAuthError, normalizeKenyanPhone, phoneAuthEmail, validatePin } from '@/lib/phone'

export default function SignUpPage() {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: phoneAuthEmail(normalized),
        password: pin,
        options: {
          data: {
            full_name: fullName,
            phone: normalized,
            account_type: 'fleet_owner',
          },
        },
      })

      if (signUpError) {
        setError(friendlyAuthError(signUpError.message))
        return
      }

      if (!data.session) {
        setError('Account was created, but this Supabase project still confirms email. Turn off Confirm email under Authentication, then sign in with this phone number and PIN.')
        return
      }

      setSuccess(true)
      router.push('/onboarding')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex lg:hidden items-center justify-center gap-2 mb-4">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Car className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FaidaFleet</span>
            </div>
            <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Join FaidaFleet
            </CardTitle>
            <CardDescription className="text-center text-base">
              Create a fleet owner account with your phone number and a PIN
            </CardDescription>
          </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSignUp} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-in slide-in-from-top">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 text-green-900 border-green-200 animate-in slide-in-from-top">
                <CheckCircle2 className="h-4 w-4 inline mr-2" />
                <AlertDescription>
                  Account created successfully! Redirecting to set up your fleet...
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading || success}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
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
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={loading || success}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-sm font-medium text-gray-700">
                PIN
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  placeholder="4 to 6 digits"
                  maxLength={6}
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={loading || success}
                />
              </div>
              <p className="text-xs text-gray-500">
                Use 4 to 6 digits. This PIN is how you sign in.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPin" className="text-sm font-medium text-gray-700">
                Confirm PIN
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  placeholder="Repeat PIN"
                  maxLength={6}
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={loading || success}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40" 
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <Sparkles className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

        </CardContent>
        <CardFooter className="flex-col space-y-2">
          <p className="text-sm text-center w-full text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </CardFooter>
        </Card>
      </div>

      {/* Right side - Benefits */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-12 text-white flex-col justify-between relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Car className="h-8 w-8" />
            </div>
            <span className="text-3xl font-bold">FaidaFleet</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Transform Your<br />
            <span className="text-indigo-200">Fleet Operations</span>
          </h1>
          <p className="text-xl text-indigo-100 max-w-md">
            Join hundreds of fleet owners who trust FaidaFleet to manage their operations efficiently.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Complete Fleet Management</h3>
              <p className="text-indigo-100 text-sm">Manage drivers, vehicles, and collections all in one place</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Real-time Analytics</h3>
              <p className="text-indigo-100 text-sm">Track revenue, expenses, and performance metrics instantly</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">M-Pesa Integration</h3>
              <p className="text-indigo-100 text-sm">Automatic reconciliation with M-Pesa transactions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
