import assert from 'node:assert/strict'
import test from 'node:test'
import {
  homePathForRole,
  isDriverOnly,
  isNavActive,
  isPathAllowedForDriver,
  primaryMembership,
} from './fleet-access'

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

test('nav links with query strings still highlight their page', () => {
  assert.equal(isNavActive('/expenses', '/expenses?new=fuel'), true)
  assert.equal(isNavActive('/trips', '/trips'), true)
  assert.equal(isNavActive('/trips', '/collections'), false)
})
