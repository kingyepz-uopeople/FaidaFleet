import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicAuthPath } from '@/lib/auth-paths'
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

  // Server-side guard for admin routes (/admin and /admin/*, excluding /admin-login)
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdminRoute) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/admin-login'
      const redirectResponse = NextResponse.redirect(redirectUrl)
      supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) =>
        redirectResponse.cookies.set(name, value, options)
      )
      return redirectResponse
    }

    const { data: isAdmin, error: rpcError } = await supabase.rpc('is_system_admin')

    if (rpcError || !isAdmin) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      const redirectResponse = NextResponse.redirect(redirectUrl)
      supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) =>
        redirectResponse.cookies.set(name, value, options)
      )
      return redirectResponse
    }
  }

  if (!user && !isPublicAuthPath(pathname)) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) =>
      redirectResponse.cookies.set(name, value, options)
    )
    return redirectResponse
  }

  return supabaseResponse
}
