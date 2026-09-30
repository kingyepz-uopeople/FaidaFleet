const PUBLIC_PREFIXES = ['/login', '/signup', '/onboarding', '/admin-login', '/reset-password', '/auth']

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
