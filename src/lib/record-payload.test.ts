import assert from 'node:assert/strict'
import test from 'node:test'
import { optionalNotes, withRecordedBy } from './record-payload'

test('inserts carry the signed-in auth user id in recorded_by', () => {
  const payload = { tenant_id: 'fleet-1', amount: 1200 }
  assert.deepEqual(withRecordedBy(payload, 'auth-user-42'), {
    tenant_id: 'fleet-1',
    amount: 1200,
    recorded_by: 'auth-user-42',
  })
  // Don't let a caller mutate the payload that is also used for updates.
  assert.deepEqual(payload, { tenant_id: 'fleet-1', amount: 1200 })
})

test('a missing session refuses the insert instead of storing NULL recorded_by', () => {
  assert.throws(() => withRecordedBy({ amount: 10 }, null), /sign in again/i)
  assert.throws(() => withRecordedBy({ amount: 10 }, undefined), /sign in again/i)
  assert.throws(() => withRecordedBy({ amount: 10 }, ''), /sign in again/i)
})

test('optional notes are trimmed or stored as NULL', () => {
  assert.equal(optionalNotes('  Fuel receipt missing  '), 'Fuel receipt missing')
  assert.equal(optionalNotes('   '), null)
  assert.equal(optionalNotes(''), null)
  assert.equal(optionalNotes(null), null)
  assert.equal(optionalNotes(undefined), null)
})
