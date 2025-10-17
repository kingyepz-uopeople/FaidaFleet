'use client''use client'<<<<<<< HEAD



import { useState } from 'react''use client'

import { useRouter } from 'next/navigation'

import Link from 'next/link'import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import { Button } from '@/components/ui/button'import { useRouter } from 'next/navigation'import { useState } from 'react'

import { Input } from '@/components/ui/input'

import { Label } from '@/components/ui/label'import Link from 'next/link'import { useRouter } from 'next/navigation'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

import { Alert, AlertDescription } from '@/components/ui/alert'import { createClient } from '@/lib/supabase/client'import Link from 'next/link'

import { Loader2, Car } from 'lucide-react'

import { Button } from '@/components/ui/button'import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {

  const [email, setEmail] = useState('')import { Input } from '@/components/ui/input'import { Button } from '@/components/ui/button'

  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)import { Label } from '@/components/ui/label'import { Input } from '@/components/ui/input'

  const [error, setError] = useState<string | null>(null)

  const router = useRouter()import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'import { Label } from '@/components/ui/label'

  const supabase = createClient()

import { Alert, AlertDescription } from '@/components/ui/alert'import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

  const handleLogin = async (e: React.FormEvent) => {

    e.preventDefault()import { Loader2, Car } from 'lucide-react'import { Alert, AlertDescription } from '@/components/ui/alert'

    setLoading(true)

    setError(null)import { Loader2 } from 'lucide-react'



    try {export default function LoginPage() {

      const { error } = await supabase.auth.signInWithPassword({

        email,  const [email, setEmail] = useState('')export default function LoginPage() {

        password,

      })  const [password, setPassword] = useState('')  const [email, setEmail] = useState('')



      if (error) {  const [loading, setLoading] = useState(false)  const [password, setPassword] = useState('')

        setError(error.message)

      } else {  const [error, setError] = useState<string | null>(null)  const [loading, setLoading] = useState(false)

        router.push('/dashboard')

        router.refresh()  const router = useRouter()  const [error, setError] = useState<string | null>(null)

      }

    } catch (err) {  const supabase = createClient()  const router = useRouter()

      setError('An unexpected error occurred')

    } finally {  const supabase = createClient()

      setLoading(false)

    }  const handleLogin = async (e: React.FormEvent) => {

  }

    e.preventDefault()  const handleLogin = async (e: React.FormEvent) => {

  const handleGoogleLogin = async () => {

    setLoading(true)    setLoading(true)    e.preventDefault()

    setError(null)

    setError(null)    setLoading(true)

    try {

      const { error } = await supabase.auth.signInWithOAuth({    setError(null)

        provider: 'google',

        options: {    try {

          redirectTo: `${window.location.origin}/auth/callback`,

        },      const { error } = await supabase.auth.signInWithPassword({    try {

      })

        email,      const { error } = await supabase.auth.signInWithPassword({

      if (error) {

        setError(error.message)        password,        email,

        setLoading(false)

      }      })        password,

    } catch (err) {

      setError('An unexpected error occurred')      })

      setLoading(false)

    }      if (error) {

  }

        setError(error.message)      if (error) {

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">      } else {        setError(error.message)

      <Card className="w-full max-w-md">

        <CardHeader className="space-y-1">        router.push('/dashboard')      } else {

          <div className="flex items-center justify-center gap-2 mb-4">

            <Car className="h-8 w-8" />        router.refresh()        router.push('/dashboard')

            <span className="text-2xl font-bold">FaidaFleet</span>

          </div>      }        router.refresh()

          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>

          <CardDescription className="text-center">    } catch (err) {      }

            Sign in to your FaidaFleet account

          </CardDescription>      setError('An unexpected error occurred')    } catch (err) {

        </CardHeader>

        <CardContent>    } finally {      setError('An unexpected error occurred')

          <form onSubmit={handleLogin} className="space-y-4">

            {error && (      setLoading(false)    } finally {

              <Alert variant="destructive">

                <AlertDescription>{error}</AlertDescription>    }      setLoading(false)

              </Alert>

            )}  }    }



            <div className="space-y-2">  }

              <Label htmlFor="email">Email</Label>

              <Input  const handleGoogleLogin = async () => {

                id="email"

                type="email"    setLoading(true)  const handleGoogleLogin = async () => {

                placeholder="m@example.com"

                value={email}    setError(null)    setLoading(true)

                onChange={(e) => setEmail(e.target.value)}

                required    setError(null)

                disabled={loading}

              />    try {

            </div>

      const { error } = await supabase.auth.signInWithOAuth({    try {

            <div className="space-y-2">

              <div className="flex items-center justify-between">        provider: 'google',      const { error } = await supabase.auth.signInWithOAuth({

                <Label htmlFor="password">Password</Label>

                <Link         options: {        provider: 'google',

                  href="/reset-password" 

                  className="text-sm text-blue-600 hover:underline"          redirectTo: `${window.location.origin}/auth/callback`,        options: {

                >

                  Forgot password?        },          redirectTo: `${window.location.origin}/auth/callback`,

                </Link>

              </div>      })        },

              <Input

                id="password"      })

                type="password"

                placeholder="••••••••"      if (error) {

                value={password}

                onChange={(e) => setPassword(e.target.value)}        setError(error.message)      if (error) {

                required

                disabled={loading}        setLoading(false)        setError(error.message)

              />

            </div>      }        setLoading(false)



            <Button     } catch (err) {      }

              type="submit" 

              className="w-full"       setError('An unexpected error occurred')    } catch (err) {

              disabled={loading}

            >      setLoading(false)      setError('An unexpected error occurred')

              {loading ? (

                <>    }      setLoading(false)

                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                  Signing in...  }    }

                </>

              ) : (  }

                'Login'

              )}  return (

            </Button>

          </form>    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">  return (



          <div className="relative my-4">      <Card className="w-full max-w-md">    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">

            <div className="absolute inset-0 flex items-center">

              <span className="w-full border-t" />        <CardHeader className="space-y-1">      <Card className="w-full max-w-md">

            </div>

            <div className="relative flex justify-center text-xs uppercase">          <div className="flex items-center justify-center gap-2 mb-4">        <CardHeader className="space-y-1">

              <span className="bg-white px-2 text-muted-foreground">Or continue with</span>

            </div>            <Car className="h-8 w-8" />          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>

          </div>

            <span className="text-2xl font-bold">FaidaFleet</span>          <CardDescription className="text-center">

          <Button

            type="button"          </div>            Sign in to your FaidaFleet account

            variant="outline"

            className="w-full"          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>          </CardDescription>

            onClick={handleGoogleLogin}

            disabled={loading}          <CardDescription className="text-center">        </CardHeader>

          >

            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">            Sign in to your FaidaFleet account        <CardContent>

              <path

                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"          </CardDescription>          <form onSubmit={handleLogin} className="space-y-4">

                fill="#4285F4"

              />        </CardHeader>            {error && (

              <path

                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"        <CardContent>              <Alert variant="destructive">

                fill="#34A853"

              />          <form onSubmit={handleLogin} className="space-y-4">                <AlertDescription>{error}</AlertDescription>

              <path

                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"            {error && (              </Alert>

                fill="#FBBC05"

              />              <Alert variant="destructive">            )}

              <path

                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"                <AlertDescription>{error}</AlertDescription>

                fill="#EA4335"

              />              </Alert>            <div className="space-y-2">

            </svg>

            Login with Google            )}=======

          </Button>

        </CardContent>import Link from "next/link"

        <CardFooter>

          <p className="text-sm text-center w-full text-muted-foreground">            <div className="space-y-2">

            Don&apos;t have an account?{' '}

            <Link href="/signup" className="text-blue-600 hover:underline font-medium">              <Label htmlFor="email">Email</Label>import { Button } from "@/components/ui/button"

              Sign up

            </Link>              <Inputimport {

          </p>

        </CardFooter>                id="email"  Card,

      </Card>

    </div>                type="email"  CardContent,

  )

}                placeholder="m@example.com"  CardDescription,


                value={email}  CardHeader,

                onChange={(e) => setEmail(e.target.value)}  CardTitle,

                required} from "@/components/ui/card"

                disabled={loading}import { Input } from "@/components/ui/input"

              />import { Label } from "@/components/ui/label"

            </div>import { Car } from "lucide-react"



            <div className="space-y-2">export default function LoginPage() {

              <div className="flex items-center justify-between">  return (

                <Label htmlFor="password">Password</Label>    <div className="flex min-h-screen items-center justify-center bg-background">

                <Link       <Card className="mx-auto max-w-sm">

                  href="/reset-password"         <CardHeader>

                  className="text-sm text-blue-600 hover:underline"          <div className="flex items-center justify-center gap-2 mb-4">

                >             <Car className="h-8 w-8" />

                  Forgot password?             <span className="text-2xl font-bold">FaidaFleet</span>

                </Link>          </div>

              </div>          <CardTitle className="text-2xl">Login</CardTitle>

              <Input          <CardDescription>

                id="password"            Enter your email below to login to your account

                type="password"          </CardDescription>

                placeholder="••••••••"        </CardHeader>

                value={password}        <CardContent>

                onChange={(e) => setPassword(e.target.value)}          <div className="grid gap-4">

                required            <div className="grid gap-2">

                disabled={loading}>>>>>>> bf3f833eb067e1ae5324e22a2df280bc76451c7b

              />              <Label htmlFor="email">Email</Label>

            </div>              <Input

                id="email"

            <Button                 type="email"

              type="submit" <<<<<<< HEAD

              className="w-full"                 placeholder="you@example.com"

              disabled={loading}                value={email}

            >                onChange={(e) => setEmail(e.target.value)}

              {loading ? (                required

                <>                disabled={loading}

                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />              />

                  Signing in...            </div>

                </>

              ) : (            <div className="space-y-2">

                'Login'              <div className="flex items-center justify-between">

              )}                <Label htmlFor="password">Password</Label>

            </Button>                <Link 

          </form>                  href="/reset-password" 

                  className="text-sm text-blue-600 hover:underline"

          <div className="relative my-4">                >

            <div className="absolute inset-0 flex items-center">                  Forgot password?

              <span className="w-full border-t" />                </Link>

            </div>              </div>

            <div className="relative flex justify-center text-xs uppercase">              <Input

              <span className="bg-white px-2 text-muted-foreground">Or continue with</span>                id="password"

            </div>                type="password"

          </div>                placeholder="••••••••"

                value={password}

          <Button                onChange={(e) => setPassword(e.target.value)}

            type="button"                required

            variant="outline"                disabled={loading}

            className="w-full"              />

            onClick={handleGoogleLogin}            </div>

            disabled={loading}

          >            <Button 

            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">              type="submit" 

              <path              className="w-full" 

                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"              disabled={loading}

                fill="#4285F4"            >

              />              {loading ? (

              <path                <>

                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                fill="#34A853"                  Signing in...

              />                </>

              <path              ) : (

                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"                'Sign in'

                fill="#FBBC05"              )}

              />            </Button>

              <path          </form>

                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"

                fill="#EA4335"          <div className="relative my-4">

              />            <div className="absolute inset-0 flex items-center">

            </svg>              <span className="w-full border-t" />

            Login with Google            </div>

          </Button>            <div className="relative flex justify-center text-xs uppercase">

        </CardContent>              <span className="bg-white px-2 text-muted-foreground">Or continue with</span>

        <CardFooter>            </div>

          <p className="text-sm text-center w-full text-muted-foreground">          </div>

            Don&apos;t have an account?{' '}

            <Link href="/signup" className="text-blue-600 hover:underline font-medium">          <Button

              Sign up            type="button"

            </Link>            variant="outline"

          </p>            className="w-full"

        </CardFooter>            onClick={handleGoogleLogin}

      </Card>            disabled={loading}

    </div>          >

  )            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">

}              <path

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
            Google
          </Button>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-center w-full text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </CardFooter>
=======
                placeholder="m@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="#"
                  className="ml-auto inline-block text-sm underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input id="password" type="password" required />
            </div>
            {/* 
              TODO: Add Supabase client logic to this button handler.
              This is a placeholder UI.
            */}
            <Button type="submit" className="w-full">
              Login
            </Button>
            <Button variant="outline" className="w-full">
              Login with Google
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="#" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
>>>>>>> bf3f833eb067e1ae5324e22a2df280bc76451c7b
      </Card>
    </div>
  )
}
