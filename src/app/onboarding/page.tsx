'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Car } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function OnboardingPage() {
  const [fleetName, setFleetName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<'starter' | 'pro' | 'enterprise'>('starter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleCreateFleet = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to create a fleet')
        setLoading(false)
        return
      }

      // Use the database function to create tenant and membership atomically
      const { data, error } = await supabase.rpc('create_tenant_with_owner', {
        tenant_name: fleetName,
        tenant_business_name: businessName || null,
        tenant_phone: phone || null,
        tenant_email: email || null,
        tenant_plan: plan
      })

      if (error) {
        console.error('Fleet creation error:', error)
        
        // Provide helpful error messages
        if (error.code === '42883') {
          setError('Database function missing. Please run migration 002_fix_onboarding.sql in Supabase. See instructions below.')
        } else if (error.code === '42P01') {
          setError('Database not set up. Please run migration 001_initial_schema.sql in Supabase SQL Editor first. See QUICK_START.md')
        } else if (error.message?.includes('Not authenticated')) {
          setError('You must be logged in. Please refresh the page and try again.')
        } else {
          setError(error.message || 'Failed to create fleet. Please check console for details.')
        }
        setLoading(false)
        return
      }

      if (!data) {
        setError('Failed to create fleet. No data returned.')
        setLoading(false)
        return
      }

      // Success! Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      console.error('Unexpected error:', err)
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Car className="h-10 w-10" />
            <span className="text-3xl font-bold">FaidaFleet</span>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Create Your Fleet</CardTitle>
          <CardDescription className="text-center">
            Welcome! Let's set up your matatu fleet management account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateFleet} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fleetName">
                  Fleet Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fleetName"
                  type="text"
                  placeholder="e.g., Kamau Transport"
                  value={fleetName}
                  onChange={(e) => setFleetName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name (Optional)</Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="e.g., Kamau Transport Ltd"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+254712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Business Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="info@kamautransport.co.ke"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={plan} onValueChange={(value: any) => setPlan(value)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Starter (Free)</span>
                      <span className="text-xs text-muted-foreground">1-3 vehicles</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pro">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Pro (KES 1,000/month)</span>
                      <span className="text-xs text-muted-foreground">4-10 vehicles</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="enterprise">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Enterprise (Custom)</span>
                      <span className="text-xs text-muted-foreground">10+ vehicles</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm text-blue-900">What happens next?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Your fleet account will be created</li>
                <li>✓ You'll be set as the owner</li>
                <li>✓ You can start adding vehicles and drivers</li>
                <li>✓ Track daily collections and expenses</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating your fleet...
                </>
              ) : (
                <>
                  <Car className="mr-2 h-5 w-5" />
                  Create Fleet & Get Started
                </>
              )}
            </Button>
          </form>

          {error && error.includes('002_fix_onboarding.sql') && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">📋 Quick Fix Instructions:</h4>
              <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
                <li>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-medium">Supabase Dashboard</a></li>
                <li>Click <strong>SQL Editor</strong> → <strong>New Query</strong></li>
                <li>Copy content from <code className="bg-yellow-100 px-1 rounded">supabase/migrations/002_fix_onboarding.sql</code></li>
                <li>Paste and click <strong>Run</strong></li>
                <li>Refresh this page and try again</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
