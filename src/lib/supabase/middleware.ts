import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicAuthPath } from '@/lib/auth-paths'
import { isDriverOnly, isPathAllowedForDriver } from '@/lib/fleet-access'
import { needsPinChange } from '@/lib/pin'
import { hasSupabaseEnv, supabaseCredentials } from '@/lib/supabase/env'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  if (!hasSupabaseEnv()) {
    return supabaseResponse
  }

  const { url, key } = supabaseCredentials()
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const redirectTo = (target: string) => {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = target
    redirectUrl.search = ''
    const redirectResponse = NextResponse.redirect(redirectUrl)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) =>
      redirectResponse.cookies.set(name, value, options)
    )
    return redirectResponse
  }

  // Server-side guard for admin routes (/admin and /admin/*, excluding /admin-login)
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdminRoute) {
    if (!user) return redirectTo('/admin-login')

    const { data: isAdmin, error: rpcError } = await supabase.rpc('is_system_admin')

    if (rpcError || !isAdmin) return redirectTo('/dashboard')
  }

  if (!user && !isPublicAuthPath(pathname)) {
    return redirectTo('/login')
  }

  // Route guard for fleet pages: a driver-only membership never reaches owner
  // pages, and a temporary PIN must be replaced before using the app.
  const isAppPage =
    Boolean(user) &&
    !isAdminRoute &&
    !pathname.startsWith('/api/') &&
    !isPublicAuthPath(pathname) &&
    pathname !== '/'

  if (isAppPage && user) {
    if (needsPinChange(user) && pathname !== '/settings') {
      return redirectTo('/settings')
    }

    const { data: membershipRows } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (isDriverOnly(membershipRows) && !isPathAllowedForDriver(pathname)) {
      return redirectTo('/trips')
    }
  }

  return supabaseResponse
}
