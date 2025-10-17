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
import { Loader2, Car, Mail, Lock, User, CheckCircle2, Sparkles, Users, BarChart3, Shield } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // Redirect to onboarding to create fleet
        setTimeout(() => {
          router.push('/onboarding')
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (err) {
      setError('An unexpected error occurred')
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
              Start managing your fleet smarter today
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
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || success}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || success}
                  minLength={6}
                />
              </div>
              <p className="text-xs text-gray-500">
                Must be at least 6 characters long
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading || success}
                  minLength={6}
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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-500 font-medium">Or sign up with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
            onClick={handleGoogleSignUp}
            disabled={loading || success}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="font-medium">Sign up with Google</span>
          </Button>
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
