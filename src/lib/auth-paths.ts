/**
 * Exact allow-list of paths that are reachable without a session.
 *
 * Pages: /login, /signup, /onboarding, /admin-login, /reset-password,
 * /auth/callback, /auth/auth-code-error, /auth/update-password, /offline.
 *
 * Signed-out auth API endpoints: these routes validate their own input and
 * enforce their own rate limits, so they must not be redirected to /login by
 * the middleware. Everything else under /api (e.g. /api/auth/change-pin,
 * /api/drivers, /api/admin/pin) stays protected and checks the session itself.
 * Use exact paths here instead of a broad prefix so no /api route is
 * accidentally made public.
 */
export const PUBLIC_AUTH_PATHS = [
  '/login',
  '/signup',
  '/onboarding',
  '/admin-login',
  '/reset-password',
  '/auth/callback',
  '/auth/auth-code-error',
  '/auth/update-password',
  '/offline',
  '/api/auth/login',
  '/api/auth/signup',
] as const

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

