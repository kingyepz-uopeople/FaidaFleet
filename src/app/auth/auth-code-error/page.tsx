'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthCodeErrorPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-red-600">
            Authentication Error
          </CardTitle>
          <CardDescription className="text-center">
            There was a problem signing you in
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            The authentication code was invalid or has expired. This can happen if:
          </p>
          <ul className="text-sm text-muted-foreground text-left space-y-2">
            <li>• The link has already been used</li>
            <li>• The link has expired</li>
            <li>• There was a network error</li>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button 
            onClick={() => router.push('/login')} 
            className="w-full"
          >
            Back to Login
          </Button>
          <Button 
            onClick={() => router.push('/signup')} 
            variant="outline"
            className="w-full"
          >
            Create New Account
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
