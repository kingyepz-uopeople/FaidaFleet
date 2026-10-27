import assert from 'node:assert/strict'
import test from 'node:test'
import { isCronRequestAuthorized } from './cron-auth'

test('cron accepts the Vercel bearer secret', () => {
  assert.equal(isCronRequestAuthorized('Bearer test-secret', null, 'test-secret'), true)
})

test('cron accepts the explicit secret header for secured manual runs', () => {
  assert.equal(isCronRequestAuthorized(null, 'test-secret', 'test-secret'), true)
})

test('cron rejects missing, incorrect and malformed credentials', () => {
  assert.equal(isCronRequestAuthorized(null, null, 'test-secret'), false)
  assert.equal(isCronRequestAuthorized('Bearer wrong', null, 'test-secret'), false)
  assert.equal(isCronRequestAuthorized('test-secret', null, 'test-secret'), false)
  assert.equal(isCronRequestAuthorized('Bearer test-secret', null, ''), false)
})
