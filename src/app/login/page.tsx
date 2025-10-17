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
import { Loader2, Car, Mail, Lock, Sparkles, TrendingUp, Shield } from 'lucide-react'

export default function LoginPage() {
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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
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
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex lg:hidden items-center justify-center gap-2 mb-4">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Car className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FaidaFleet</span>
            </div>
            <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Welcome back
            </CardTitle>
            <CardDescription className="text-center text-base">
              Sign in to manage your fleet
            </CardDescription>
          </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="animate-in slide-in-from-top">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

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
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <Link 
                  href="/reset-password" 
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Forgot?
                </Link>
              </div>
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
                  disabled={loading}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <span>Sign In</span>
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
              <span className="bg-white px-3 text-gray-500 font-medium">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
            onClick={handleGoogleLogin}
            disabled={loading}
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
            <span className="font-medium">Sign in with Google</span>
          </Button>
        </CardContent>
        <CardFooter className="flex-col space-y-2">
          <p className="text-sm text-center w-full text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Sign up for free
            </Link>
          </p>
        </CardFooter>
        </Card>
      </div>
    </div>
  )
}
