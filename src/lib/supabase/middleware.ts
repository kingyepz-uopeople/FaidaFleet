import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicAuthPath } from '@/lib/auth-paths'
import { isDriverOnly, isPathAllowedForDriver } from '@/lib/fleet-access'
import { needsPinChange } from '@/lib/pin'
import { hasSupabaseEnv, supabaseCredentials } from '@/lib/supabase/env'
import { encodeFleetContext, FLEET_CONTEXT_HEADER, sanitizedRequestHeaders } from '@/lib/supabase/request-context'

export async function updateSession(request: NextRequest) {
  // Never accept an access snapshot supplied by the browser. This is done even
  // when Supabase is not configured or a route is public.
  const requestHeaders = sanitizedRequestHeaders(request.headers)
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
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
          // Forward refreshed cookies alongside the sanitized request headers.
          const cookieHeader = request.headers.get('cookie')
          if (cookieHeader) requestHeaders.set('cookie', cookieHeader)
          else requestHeaders.delete('cookie')
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
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

    const { data: membershipRows, error: membershipError } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (isDriverOnly(membershipRows) && !isPathAllowedForDriver(pathname)) {
      return redirectTo('/trips')
    }

    // Only forward the result of a successful verified lookup. On failure (or
    // an oversized profile), the layout falls back to its own session read.
    const context = !membershipError && membershipRows
      ? encodeFleetContext({ user, memberships: membershipRows })
      : null
    if (context) {
      requestHeaders.set(FLEET_CONTEXT_HEADER, context)
      // Rebuilding the response must retain any cookies refreshed by Supabase.
      const refreshedCookies = supabaseResponse.cookies.getAll()
      supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
      refreshedCookies.forEach(({ name, value, ...options }) =>
        supabaseResponse.cookies.set(name, value, options)
      )
    }
  }

  return supabaseResponse
}
