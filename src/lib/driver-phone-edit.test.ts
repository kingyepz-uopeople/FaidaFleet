import assert from 'node:assert/strict'
import test from 'node:test'
import { driverPhoneEditError } from './driver-phone-edit'

test('only the linked-driver phone refusal gets the recovery guidance', () => {
  const triggerError = 'Driver login and phone cannot be changed directly'
  assert.match(driverPhoneEditError(triggerError, '0712345678', '0723456789') || '', /PIN login belongs to this phone number.*recreate the driver/)
  assert.equal(driverPhoneEditError(triggerError, '0712345678', '0712345678'), null)
  assert.equal(driverPhoneEditError(triggerError, undefined, '0723456789'), null)
  assert.equal(driverPhoneEditError('Other error', '0712345678', '0723456789'), null)
})
