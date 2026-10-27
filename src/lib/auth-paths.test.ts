import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicAuthPath } from './auth-paths'

test('isPublicAuthPath lets signed-out users reach login/signup pages', () => {
  for (const path of ['/login', '/signup', '/onboarding', '/admin-login', '/reset-password', '/offline']) {
    assert.equal(isPublicAuthPath(path), true, `${path} should be public for signed-out users`)
  }
})

test('isPublicAuthPath lets signed-out users reach /api/auth/login and /api/auth/signup', () => {
  assert.equal(isPublicAuthPath('/api/auth/login'), true)
  assert.equal(isPublicAuthPath('/api/auth/signup'), true)
})

test('isPublicAuthPath keeps other /api paths protected for signed-out users', () => {
  for (const path of [
    '/api/auth/change-pin',
    '/api/drivers',
    '/api/drivers/123',
    '/api/drivers/123/pin',
    '/api/admin/pin',
  ]) {
    assert.equal(isPublicAuthPath(path), false, `${path} should require a session`)
  }
})

test('isPublicAuthPath keeps the supabase auth pages public exactly as before', () => {
  for (const path of ['/auth/callback', '/auth/auth-code-error', '/auth/update-password']) {
    assert.equal(isPublicAuthPath(path), true, `${path} should be public for signed-out users`)
  }
  // A broad /auth prefix is no longer used: nothing under /api/auth slips in
  // except the explicitly allowed login and signup endpoints.
  assert.equal(isPublicAuthPath('/api/auth/me'), false)
})
