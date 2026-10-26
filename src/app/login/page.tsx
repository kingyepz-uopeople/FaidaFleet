'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Car, Phone, Lock } from '@/components/icons'
import { normalizeKenyanPhone, validatePin } from '@/lib/phone'
import { AuthShell } from '@/components/auth-shell'

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
    <AuthShell>
      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-2">
          <div className="mb-2 flex items-center justify-center gap-2 lg:hidden">
            <div className="rounded-xl bg-primary p-2">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-semibold">FaidaFleet</span>
          </div>
          <CardTitle className="text-center text-2xl">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Fleet owners and drivers sign in with a phone number and PIN
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
              <Label htmlFor="phone">Phone number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0712345678"
                  className="pl-10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="4 to 6 digits"
                  maxLength={6}
                  className="pl-10"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Forgot your PIN? Ask a system administrator to reset it. Fleet owners can also reset a driver PIN from the driver record. Signed-in users can change their own PIN in Settings.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
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
        <CardFooter className="flex-col space-y-3 border-t pt-6">
          <p className="w-full text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-primary">Sign up</Link>
          </p>
          <p className="w-full text-center text-sm text-muted-foreground">
            System administrator?{' '}
            <Link href="/admin-login" className="font-semibold text-primary">Sign in with email</Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  )
}
