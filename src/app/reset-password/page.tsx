'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft } from '@/components/icons'
import { AuthShell } from '@/components/auth-shell'
import { isPhoneAuthEmail } from '@/lib/phone'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    if (isPhoneAuthEmail(email.trim())) {
      setError('Fleet owners and drivers do not use email reset. Ask a system administrator to reset the PIN.')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell variant="admin" headline="Admin password reset" subhead="Email password reset is only for system administrators.">
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Reset admin password</CardTitle>
          <CardDescription className="text-center">
            System administrators can reset an email password here. Fleet owners and drivers cannot recover a forgotten PIN themselves — ask a system administrator to set a new one. Signed-in users can change a remembered PIN in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                <AlertDescription>
                  Password reset link has been sent to your email. Please check your inbox.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || success}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <Link href="/admin-login" className="flex min-h-11 items-center gap-1 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to admin sign-in
          </Link>
        </CardFooter>
      </Card>
    </AuthShell>
  )
}
