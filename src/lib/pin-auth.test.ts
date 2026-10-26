import assert from 'node:assert/strict'
import test from 'node:test'
import {
  authPasswordFromPin,
  friendlyPinError,
  PIN_PEPPER_FALLBACK,
  SAME_PIN_MESSAGE,
} from './pin-auth'

test('6-digit PINs are stored unchanged for existing accounts', () => {
  assert.equal(authPasswordFromPin('123456'), '123456')
  assert.equal(authPasswordFromPin('000000'), '000000')
})

test('4- and 5-digit PINs get a server-only pepper and reach Supabase length', () => {
  const previous = process.env.PIN_PEPPER
  delete process.env.PIN_PEPPER
  try {
    assert.equal(authPasswordFromPin('2468'), `2468${PIN_PEPPER_FALLBACK}`)
    assert.equal(authPasswordFromPin('12345'), `12345${PIN_PEPPER_FALLBACK}`)
    assert.equal(authPasswordFromPin('2468').length >= 6, true)
    assert.equal(authPasswordFromPin('2468').startsWith('2468'), true)

    process.env.PIN_PEPPER = ' custom-pepper '
    assert.equal(authPasswordFromPin('2468'), '2468custom-pepper')
  } finally {
    if (previous === undefined) delete process.env.PIN_PEPPER
    else process.env.PIN_PEPPER = previous
  }
})

test('invalid PINs are rejected and the transform never runs in a browser', () => {
  assert.throws(() => authPasswordFromPin('123'), /4 to 6 digits/)
  assert.throws(() => authPasswordFromPin('12ab'), /digits only/)
  assert.throws(() => authPasswordFromPin('1234567'), /4 to 6 digits/)

  const globals = globalThis as Record<string, unknown>
  globals.window = {}
  try {
    assert.throws(() => authPasswordFromPin('1234'), /only be built on the server/)
  } finally {
    delete globals.window
  }
})

test('Supabase same-password errors become a friendly PIN message', () => {
  assert.equal(friendlyPinError('New password should be different from the old password.'), SAME_PIN_MESSAGE)
  assert.match(friendlyPinError('Invalid login credentials'), /PIN is incorrect/)
})
