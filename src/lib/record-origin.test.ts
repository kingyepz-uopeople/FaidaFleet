import assert from 'node:assert/strict'
import test from 'node:test'
import { recordOrigin } from './record-origin'

test('a driver-authored row is labelled as entered by the driver', () => {
  assert.equal(recordOrigin('auth-driver', 'auth-driver'), 'Entered by driver')
})

test('a backup entry by another auth user is labelled as entered by the owner', () => {
  assert.equal(recordOrigin('auth-owner', 'auth-driver'), 'Entered by owner')
  assert.equal(recordOrigin('auth-owner', null), 'Entered by owner')
})

test('legacy rows with null recorded_by have no origin label', () => {
  assert.equal(recordOrigin(null, 'auth-driver'), null)
  assert.equal(recordOrigin(undefined, 'auth-driver'), null)
})
