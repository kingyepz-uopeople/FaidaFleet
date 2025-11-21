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
              Enter your credentials to access your fleet dashboard
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
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  className="pl-10 h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Password
                </Label>
                <Link 
                  href="/reset-password" 
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-12 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-600">Or continue with</span>
            </div>
          </div>

          <Button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-all"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <image href="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIyLjU2IDEyLjI1QzIyLjU2IDExLjQyIDIyLjQ5IDEwLjYzIDIyLjM2IDkuODZIMTJWMTQuNDVIMTcuODZDMTcuNjUgMTUuNjQgMTYuODkgMTYuNjMgMTUuNzcgMTcuMzFWMTkuNDhIMTkuMjJDMjAuODEgMTguMjUgMjIuNTYgMTUuNzYgMjIuNTYgMTIuMjVaIiBmaWxsPSIjNDI4NUY0Ii8+CjxwYXRoIGQ9Ik0xMiAyMS41QzE1LjEgMjEuNSAxNy43IDIwLjMzIDE5LjIyIDE4LjQ4TDE3Ljc3IDE3LjMxQzE2Ljk2IDE3LjkzIDE1LjkyIDE4LjMzIDE0Ljk5IDE4LjMzQzEzLjE5IDE4LjMzIDExLjY0IDE3LjI2IDExLjA1IDE1LjcxSDE5LjUyVjE1LjA1SDE1LjkzQzE1Ljg2IDE0LjE1IDE1LjczIDEzLjM1IDE1LjQ4IDEyLjYySDEyWiIgZmlsbD0iIzM0QTg1MyIvPgo8L3N2Zz4=" width="24" height="24" />
            </svg>
            Google
          </Button>

        </CardContent>
        <CardFooter className="flex-col space-y-4 pt-6 border-t border-gray-200">
          <p className="text-sm text-center w-full text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Sign up now
            </Link>
          </p>
          <p className="text-xs text-center text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardFooter>
        </Card>
      </div>
    </div>
  )
}
