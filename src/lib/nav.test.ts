import assert from 'node:assert/strict'
import test from 'node:test'
import { appHeaderTitle, bottomNavForRole, driverMenuItems, fleetMenuForRole, fleetMenuItems } from './nav'

test('unknown/loading role never renders owner-only navigation', () => {
  for (const role of [null, undefined, '', 'unknown']) {
    assert.deepEqual(fleetMenuForRole(role), [])
    assert.deepEqual(bottomNavForRole(role), [])
  }
})

test('header titles use driver wording for driver pages', () => {
  assert.equal(appHeaderTitle('/trips', true), 'My trips')
  assert.equal(appHeaderTitle('/collections', true), 'My collections')
  assert.equal(appHeaderTitle('/expenses', true), 'My expenses & fuel')
  assert.equal(appHeaderTitle('/maintenance', true), 'My maintenance')
  assert.equal(appHeaderTitle('/settings', true), 'Settings')
  assert.equal(appHeaderTitle('/trips', false), 'Trips')
  assert.equal(appHeaderTitle('/dashboard', false), 'Dashboard')
  assert.equal(appHeaderTitle('/driver-analytics', false), 'Driver stats')
  assert.equal(appHeaderTitle('/', false), 'Dashboard')
})

test('drivers get only their own menu, owners get the full menu', () => {
  assert.deepEqual(fleetMenuForRole('driver'), driverMenuItems)
  assert.deepEqual(bottomNavForRole('driver'), driverMenuItems.slice(0, 5))
  assert.equal(fleetMenuForRole('driver').some((item) => item.href === '/dashboard'), false)
  assert.deepEqual(fleetMenuForRole('owner'), fleetMenuItems)
  assert.deepEqual(fleetMenuForRole('admin'), fleetMenuItems)
  assert.deepEqual(fleetMenuForRole('accountant'), fleetMenuItems)
  assert.equal(bottomNavForRole('owner').length, 5)
})
