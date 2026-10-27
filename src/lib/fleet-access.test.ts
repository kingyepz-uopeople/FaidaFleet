import assert from 'node:assert/strict'
import test from 'node:test'
import {
  accessFromMemberships,
  EMPTY_FLEET_ACCESS_SNAPSHOT,
  fleetAccessPhases,
  homePathForRole,
  isDriverOnly,
  isFleetManagerRole,
  isNavActive,
  isPathAllowedForDriver,
  membershipAccess,
  primaryMembership,
  type FleetAccessSnapshot,
} from './fleet-access'

const driverUser = {
  id: 'auth-driver-1',
  user_metadata: { account_type: 'driver', must_change_pin: true },
} as unknown as FleetAccessSnapshot['user']

test('primaryMembership picks a deterministic role with several active memberships', () => {
  const rows = [
    { tenant_id: 'fleet-a', role: 'driver' },
    { tenant_id: 'fleet-b', role: 'admin' },
    { tenant_id: 'fleet-c', role: 'owner' },
  ]
  assert.equal(primaryMembership(rows)?.tenant_id, 'fleet-c')
  assert.equal(primaryMembership(rows.slice(0, 2))?.tenant_id, 'fleet-b')
  assert.equal(primaryMembership([]), null)
  assert.equal(primaryMembership(null), null)
})

test('driver-only accounts land on /trips and cannot open owner pages', () => {
  assert.equal(isDriverOnly([{ tenant_id: 'fleet-a', role: 'driver' }]), true)
  assert.equal(isDriverOnly([{ tenant_id: 'fleet-a', role: 'driver' }, { tenant_id: 'fleet-b', role: 'owner' }]), false)
  assert.equal(isDriverOnly([]), false)
  assert.equal(homePathForRole('driver'), '/trips')
  assert.equal(homePathForRole('owner'), '/dashboard')
  for (const path of ['/trips', '/collections', '/expenses', '/maintenance', '/settings']) {
    assert.equal(isPathAllowedForDriver(path), true)
  }
  for (const path of ['/dashboard', '/vehicles', '/drivers', '/analytics', '/driver-analytics', '/admin']) {
    assert.equal(isPathAllowedForDriver(path), false)
  }
})

test('server snapshot resolves role and tenant from memberships', () => {
  const rows = [
    { tenant_id: 'fleet-a', role: 'driver' },
    { tenant_id: 'fleet-b', role: 'owner' },
  ]
  assert.deepEqual(membershipAccess(rows), {
    role: 'owner',
    isDriver: false,
    tenantId: 'fleet-b',
  })
  const snapshot = accessFromMemberships([{ tenant_id: 'fleet-a', role: 'driver' }], driverUser)
  assert.deepEqual(snapshot, {
    ready: true,
    user: driverUser,
    role: 'driver',
    isDriver: true,
    mustChangePin: true,
    tenantId: 'fleet-a',
  })
  assert.equal(accessFromMemberships(null, null).ready, false)
  assert.equal(accessFromMemberships([], driverUser).ready, false)
  assert.equal(EMPTY_FLEET_ACCESS_SNAPSHOT.role, null)
  assert.equal(isFleetManagerRole('accountant'), true)
  assert.equal(isFleetManagerRole('driver'), false)
  assert.equal(isFleetManagerRole(null), false)
})

test('loading phases keep counts hidden until scope data is ready', () => {
  assert.deepEqual(fleetAccessPhases({ ready: true, isDriver: false }), {
    loading: false,
    roleLoading: false,
    scopeLoading: false,
  })
  assert.deepEqual(fleetAccessPhases({ ready: true, isDriver: true }), {
    loading: true,
    roleLoading: false,
    scopeLoading: true,
  })
  assert.deepEqual(fleetAccessPhases({ ready: false, isDriver: false }), {
    loading: true,
    roleLoading: true,
    scopeLoading: false,
  })
})

test('nav links with query strings still highlight their page', () => {
  assert.equal(isNavActive('/expenses', '/expenses?new=fuel'), true)
  assert.equal(isNavActive('/trips', '/trips'), true)
  assert.equal(isNavActive('/trips', '/collections'), false)
})
