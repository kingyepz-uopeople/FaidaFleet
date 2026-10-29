import assert from 'node:assert/strict'
import test from 'node:test'
import {
  actorRoleLabel,
  canFleetResetDriverPin,
  canSystemAdminResetPin,
  generatePin,
  isFleetPinManager,
  needsPinChange,
  pinResetDeniedMessage,
  resolvePinInput,
} from './pin'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, validatePin } from './phone'
import {
  evaluateRateLimit,
  LOGIN_RATE_LIMIT,
  rateLimitMessage,
  recordRateLimitFailure,
  retryAfterSeconds,
} from './rate-limit'

test('generatePin returns a valid 4 to 6 digit PIN', () => {
  for (let i = 0; i < 20; i += 1) {
    const pin = generatePin()
    assert.equal(validatePin(pin), null)
    assert.match(pin, /^\d{6}$/)
  }
  assert.match(generatePin(4), /^\d{4}$/)
  assert.throws(() => generatePin(3))
  assert.throws(() => generatePin(7))
})

test('resolvePinInput prefers a typed PIN and otherwise generates one', () => {
  const typed = resolvePinInput({ pin: '2468' })
  assert.equal(typed.ok, true)
  if (typed.ok) {
    assert.equal(typed.pin, '2468')
    assert.equal(typed.generated, false)
  }

  const generated = resolvePinInput({ generate: true })
  assert.equal(generated.ok, true)
  if (generated.ok) {
    assert.equal(validatePin(generated.pin), null)
    assert.equal(generated.generated, true)
  }

  const missing = resolvePinInput({ generate: false })
  assert.equal(missing.ok, false)

  const invalid = resolvePinInput({ pin: '12' })
  assert.equal(invalid.ok, false)
  if (!invalid.ok) {
    assert.match(invalid.error, /4 to 6 digits/)
  }
})

test('fleet owners and admins can reset a driver PIN only in the same tenant', () => {
  assert.equal(isFleetPinManager('owner'), true)
  assert.equal(isFleetPinManager('admin'), true)
  assert.equal(isFleetPinManager('driver'), false)
  assert.equal(
    canFleetResetDriverPin({ actorRole: 'owner', actorTenantId: 't1', driverTenantId: 't1' }),
    true,
  )
  assert.equal(
    canFleetResetDriverPin({ actorRole: 'admin', actorTenantId: 't1', driverTenantId: 't1' }),
    true,
  )
  assert.equal(
    canFleetResetDriverPin({ actorRole: 'owner', actorTenantId: 't1', driverTenantId: 't2' }),
    false,
  )
  assert.equal(
    canFleetResetDriverPin({ actorRole: 'driver', actorTenantId: 't1', driverTenantId: 't1' }),
    false,
  )
  assert.equal(
    canFleetResetDriverPin({ actorRole: 'owner', actorTenantId: null, driverTenantId: 't1' }),
    false,
  )
})

test('only system admins can reset fleet owner PINs', () => {
  assert.equal(canSystemAdminResetPin(true), true)
  assert.equal(canSystemAdminResetPin(false), false)
  assert.match(pinResetDeniedMessage('driver'), /fleet owner or admin/)
  assert.match(pinResetDeniedMessage('fleet_owner'), /system administrator/)
})

test('must_change_pin trusts only app metadata', () => {
  assert.equal(needsPinChange({ app_metadata: { must_change_pin: true }, user_metadata: { must_change_pin: false } }), true)
  assert.equal(needsPinChange({ user_metadata: { must_change_pin: false } }), false)
  assert.equal(needsPinChange({ user_metadata: { must_change_pin: true } }), false)
  assert.equal(needsPinChange({ app_metadata: { must_change_pin: false }, user_metadata: { must_change_pin: true } }), false)
  assert.equal(actorRoleLabel({ isSystemAdmin: true, membershipRole: 'owner' }), 'system_admin')
  assert.equal(actorRoleLabel({ isSystemAdmin: false, membershipRole: 'owner' }), 'owner')
})

test('rate limit locks after the configured number of failed PIN attempts', () => {
  const now = 1_000_000
  let window = evaluateRateLimit(undefined, now, LOGIN_RATE_LIMIT).fresh
  for (let i = 0; i < LOGIN_RATE_LIMIT.maxAttempts - 1; i += 1) {
    const recorded = recordRateLimitFailure(window, now, LOGIN_RATE_LIMIT)
    assert.equal(recorded.decision.allowed, true)
    window = recorded.next
  }
  const locked = recordRateLimitFailure(window, now, LOGIN_RATE_LIMIT)
  assert.equal(locked.decision.allowed, false)
  assert.equal(locked.decision.retryAfterMs > 0, true)
  assert.equal(retryAfterSeconds(locked.decision.retryAfterMs), Math.ceil(LOGIN_RATE_LIMIT.windowMs / 1000))
  assert.match(rateLimitMessage(locked.decision.retryAfterMs), /Try again/)

  const later = evaluateRateLimit(locked.next, now + LOGIN_RATE_LIMIT.windowMs, LOGIN_RATE_LIMIT)
  assert.equal(later.decision.allowed, true)
  assert.equal(later.fresh.count, 0)
})

test('PIN length constants stay aligned with validatePin', () => {
  assert.equal(PIN_MIN_LENGTH, 4)
  assert.equal(PIN_MAX_LENGTH, 6)
})


test('PIN targets cannot cross tenants or include privileged memberships', async () => {
  const { permitsPinTarget } = await import('./pin-reset')
  const driver = { tenant_id: 'a', role: 'driver' }
  assert.equal(permitsPinTarget([driver], 'a', true), true)
  assert.equal(permitsPinTarget([], 'a', true), false)
  assert.equal(permitsPinTarget([driver, { tenant_id: 'b', role: 'driver' }], 'a', true), false)
  assert.equal(permitsPinTarget([driver, { tenant_id: 'a', role: 'owner' }], 'a', true), false)
  assert.equal(permitsPinTarget([{ tenant_id: 'a', role: 'owner' }], 'a', false), true)
  assert.equal(permitsPinTarget([{ tenant_id: 'b', role: 'owner' }], 'a', false), false)
})
