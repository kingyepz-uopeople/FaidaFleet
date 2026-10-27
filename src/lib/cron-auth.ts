import { timingSafeEqual } from 'node:crypto'

function sameSecret(candidate: string | null, secret: string): boolean {
  if (!candidate) return false
  const left = Buffer.from(candidate)
  const right = Buffer.from(secret)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Vercel sends Authorization: Bearer CRON_SECRET; manual callers may use x-cron-secret. */
export function isCronRequestAuthorized(
  authorization: string | null,
  cronSecretHeader: string | null,
  secret: string,
): boolean {
  if (!secret) return false
  const bearer = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
  return sameSecret(bearer, secret) || sameSecret(cronSecretHeader, secret)
}
