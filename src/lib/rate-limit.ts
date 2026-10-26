export type RateLimitWindow = {
  count: number
  windowStart: number
}

export type RateLimitConfig = {
  maxAttempts: number
  windowMs: number
}

export type RateLimitDecision =
  | { allowed: true; remaining: number; retryAfterMs: 0 }
  | { allowed: false; remaining: 0; retryAfterMs: number }

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
}

export const PIN_RESET_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 8,
  windowMs: 15 * 60 * 1000,
}

const store = new Map<string, RateLimitWindow>()

export function evaluateRateLimit(
  window: RateLimitWindow | undefined,
  now: number,
  config: RateLimitConfig,
): { fresh: RateLimitWindow; decision: RateLimitDecision } {
  const expired = !window || now - window.windowStart >= config.windowMs
  const fresh: RateLimitWindow = expired
    ? { count: 0, windowStart: now }
    : { count: window.count, windowStart: window.windowStart }

  if (fresh.count >= config.maxAttempts) {
    return {
      fresh,
      decision: {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, config.windowMs - (now - fresh.windowStart)),
      },
    }
  }

  return {
    fresh,
    decision: {
      allowed: true,
      remaining: config.maxAttempts - fresh.count,
      retryAfterMs: 0,
    },
  }
}

export function recordRateLimitFailure(
  window: RateLimitWindow,
  now: number,
  config: RateLimitConfig,
): { next: RateLimitWindow; decision: RateLimitDecision } {
  const next: RateLimitWindow = {
    count: window.count + 1,
    windowStart: window.windowStart || now,
  }
  if (next.count >= config.maxAttempts) {
    return {
      next,
      decision: {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, config.windowMs - (now - next.windowStart)),
      },
    }
  }
  return {
    next,
    decision: {
      allowed: true,
      remaining: config.maxAttempts - next.count,
      retryAfterMs: 0,
    },
  }
}

export function retryAfterSeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000))
}

export function rateLimitMessage(retryAfterMs: number): string {
  const seconds = retryAfterSeconds(retryAfterMs)
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60)
    return `Too many PIN attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
  }
  return `Too many PIN attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
}

export function inspectRateLimit(key: string, config: RateLimitConfig, now = Date.now()): RateLimitDecision {
  const { fresh, decision } = evaluateRateLimit(store.get(key), now, config)
  store.set(key, fresh)
  return decision
}

export function hitRateLimit(key: string, config: RateLimitConfig, now = Date.now()): RateLimitDecision {
  const current = store.get(key)
  const { fresh } = evaluateRateLimit(current, now, config)
  const { next, decision } = recordRateLimitFailure(fresh, now, config)
  store.set(key, next)
  return decision
}

export function clearRateLimit(key: string): void {
  store.delete(key)
}

export function loginRateLimitKey(phone: string): string {
  return `login:${phone}`
}

export function loginIpRateLimitKey(ip: string): string {
  return `login-ip:${ip}`
}

export function pinResetRateLimitKey(actorId: string): string {
  return `pin-reset:${actorId}`
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
