import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicAuthPath } from './auth-paths'
import { interpretDriverSignUp } from './create-driver-login'
import {
  accountContact,
  accountInitials,
  accountLabel,
  displayPhoneFromAuthEmail,
  friendlyAuthError,
  isPhoneAuthEmail,
  normalizeKenyanPhone,
  phoneAuthEmail,
  validatePin,
} from './phone'

test('Kenyan numbers normalize to E.164', () => {
  assert.equal(normalizeKenyanPhone('0712 345 678'), '+254712345678')
  assert.equal(normalizeKenyanPhone('+254712345678'), '+254712345678')
  assert.equal(normalizeKenyanPhone('254712345678'), '+254712345678')
  assert.equal(normalizeKenyanPhone('712345678'), '+254712345678')
  assert.equal(normalizeKenyanPhone('0112345678'), '+254112345678')
  assert.equal(normalizeKenyanPhone('0722'), null)
  assert.equal(normalizeKenyanPhone('user@example.com'), null)
})

test('phone accounts use an internal sign-in address and a 4 to 6 digit PIN', () => {
  assert.equal(phoneAuthEmail('+254712345678'), '254712345678@phone.faidafleet.local')
  assert.equal(isPhoneAuthEmail('254712345678@phone.faidafleet.local'), true)
  assert.equal(isPhoneAuthEmail('admin@faidafleet.com'), false)
  assert.equal(displayPhoneFromAuthEmail('254712345678@phone.faidafleet.local'), '+254712345678')
  assert.equal(validatePin('1234'), null)
  assert.equal(validatePin('123456'), null)
  assert.equal(validatePin('123'), 'PIN must be 4 to 6 digits')
  assert.equal(validatePin('1234567'), 'PIN must be 4 to 6 digits')
  assert.equal(validatePin('12ab'), 'PIN must contain digits only')
})

test('phone accounts display a name or phone number', () => {
  const driver = {
    email: '254712345678@phone.faidafleet.local',
    user_metadata: { full_name: 'Amina Yusuf', phone: '+254712345678', account_type: 'driver' },
  }
  assert.equal(accountLabel(driver), 'Amina Yusuf')
  assert.equal(accountContact(driver), '+254712345678')
  assert.equal(accountInitials(driver), 'AY')

  const unnamed = { email: '254712345678@phone.faidafleet.local', user_metadata: { account_type: 'fleet_owner' } }
  assert.equal(accountLabel(unnamed), '+254712345678')
  assert.equal(accountInitials(unnamed), '78')
  assert.equal(accountContact({ email: 'admin@faidafleet.com' }), 'admin@faidafleet.com')
})

test('public auth routes include fleet and system admin sign-in', () => {
  assert.equal(isPublicAuthPath('/login'), true)
  assert.equal(isPublicAuthPath('/signup'), true)
  assert.equal(isPublicAuthPath('/admin-login'), true)
  assert.equal(isPublicAuthPath('/auth/callback'), true)
  assert.equal(isPublicAuthPath('/reset-password'), true)
  assert.equal(isPublicAuthPath('/dashboard'), false)
  assert.equal(isPublicAuthPath('/admin'), false)
})

test('driver sign-up results explain confirmation and duplicate phones', () => {
  assert.deepEqual(
    interpretDriverSignUp({ errorMessage: null, userId: 'user-1', identityCount: 1, confirmed: true }),
    { userId: 'user-1' },
  )
  assert.deepEqual(
    interpretDriverSignUp({ errorMessage: 'User already registered', userId: null, identityCount: 0, confirmed: false }),
    { error: 'That phone number already has a login. The driver can sign in with their PIN.' },
  )
  assert.equal(
    'error' in interpretDriverSignUp({ errorMessage: null, userId: 'user-1', identityCount: 1, confirmed: false }),
    true,
  )
  assert.match(friendlyAuthError('Invalid login credentials'), /PIN/)
  assert.match(friendlyAuthError('Invalid login credentials', 'email'), /password/)
})
