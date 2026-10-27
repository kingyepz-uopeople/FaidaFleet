import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { updateSession } from './middleware'
import { decodeFleetContext, encodeFleetContext, FLEET_CONTEXT_HEADER, sanitizedRequestHeaders } from './request-context'
import type { User } from '@supabase/supabase-js'

type MockOptions = {
  role?: string
  roles?: string[]
  mustChangePin?: boolean
  expired?: boolean
  membershipError?: boolean
  isAdmin?: boolean
  oversized?: boolean
}

const userId = 'd85d7b67-3a35-411d-a09f-f744fdd344aa'
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

async function withMockSupabase(options: MockOptions, run: (input: { cookie: string; calls: string[] }) => Promise<void>) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const previousFetch = globalThis.fetch
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sample.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key'
  const user = {
    id: userId,
    aud: 'authenticated',
    created_at: '2020-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: { full_name: options.oversized ? 'x'.repeat(5000) : 'Mumbi 🚗', must_change_pin: Boolean(options.mustChangePin) },
  }
  const now = Math.floor(Date.now() / 1000)
  const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, exp: now + 3600, role: 'authenticated' })}.signature`
  const session = { access_token: accessToken, refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600, expires_at: options.expired ? now - 1 : now + 3600, user }
  const cookie = `sb-sample-auth-token=base64-${encode(session)}`
  const calls: string[] = []
  globalThis.fetch = async (input) => {
    const url = String(input)
    calls.push(url)
    const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/auth/v1/token')) return response({ ...session, expires_at: now + 3600, refresh_token: 'refreshed' })
    if (url.includes('/auth/v1/user')) return response(user)
    if (url.includes('/rest/v1/memberships')) {
      const roles = options.roles || [options.role || 'owner']
      return options.membershipError ? response({ message: 'membership unavailable' }, 500) : response(roles.map((role, index) => ({ tenant_id: `fleet-${index + 1}`, role })))
    }
    if (url.includes('/rest/v1/rpc/is_system_admin')) return response(Boolean(options.isAdmin))
    throw new Error(`Unexpected request: ${url}`)
  }
  try {
    await run({ cookie, calls })
  } finally {
    globalThis.fetch = previousFetch
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey
  }
}

function forwardedContext(response: Response) {
  return decodeFleetContext(response.headers.get(`x-middleware-request-${FLEET_CONTEXT_HEADER}`))
}

test('untrusted incoming context and internal override are stripped', async () => {
  const input = new Headers({ [FLEET_CONTEXT_HEADER]: 'forged', [`x-middleware-request-${FLEET_CONTEXT_HEADER}`]: 'forged', 'x-other': 'kept' })
  const sanitized = sanitizedRequestHeaders(input)
  assert.equal(sanitized.get(FLEET_CONTEXT_HEADER), null)
  assert.equal(sanitized.get(`x-middleware-request-${FLEET_CONTEXT_HEADER}`), null)
  assert.equal(sanitized.get('x-other'), 'kept')
  assert.equal(input.get(FLEET_CONTEXT_HEADER), 'forged')
  assert.equal(decodeFleetContext('%not-json'), null)
  assert.equal(decodeFleetContext(encodeURIComponent('{"user":{"id":"x"},"memberships":[{}]}')), null)
})

test('middleware replaces a spoofed snapshot with the verified user and memberships', async () => {
  await withMockSupabase({}, async ({ cookie, calls }) => {
    const response = await updateSession(new NextRequest('http://localhost/analytics', {
      headers: { cookie, [FLEET_CONTEXT_HEADER]: 'forged', [`x-middleware-request-${FLEET_CONTEXT_HEADER}`]: 'forged' },
    }))
    assert.equal(response.status, 200)
    const context = forwardedContext(response)
    assert.equal(context?.user.id, userId)
    assert.equal(context?.user.user_metadata.full_name, 'Mumbi 🚗')
    assert.deepEqual(context?.memberships, [{ tenant_id: 'fleet-1', role: 'owner' }])
    assert.equal(calls.filter((url) => url.includes('/auth/v1/user')).length, 1)
    assert.equal(calls.filter((url) => url.includes('/rest/v1/memberships')).length, 1)
  })
})

test('refreshed cookies reach both the browser and the downstream request', async () => {
  await withMockSupabase({ expired: true }, async ({ cookie }) => {
    const response = await updateSession(new NextRequest('http://localhost/trips', { headers: { cookie } }))
    assert.ok(response.headers.get('set-cookie')?.includes('sb-sample-auth-token='))
    const forwardedCookie = response.headers.get('x-middleware-request-cookie') || ''
    const encoded = forwardedCookie.split('base64-')[1]
    assert.equal(JSON.parse(Buffer.from(encoded, 'base64url').toString()).refresh_token, 'refreshed')
    assert.equal(forwardedContext(response)?.user.id, userId)
  })
})

test('driver, temporary PIN and system admin route guards are unchanged', async () => {
  await withMockSupabase({ role: 'driver' }, async ({ cookie }) => {
    const response = await updateSession(new NextRequest('http://localhost/analytics', { headers: { cookie } }))
    assert.equal(new URL(response.headers.get('location')!).pathname, '/trips')
    const allowed = await updateSession(new NextRequest('http://localhost/expenses', { headers: { cookie } }))
    assert.equal(forwardedContext(allowed)?.memberships[0].role, 'driver')
  })
  await withMockSupabase({ roles: ['driver', 'owner'] }, async ({ cookie }) => {
    const response = await updateSession(new NextRequest('http://localhost/analytics', { headers: { cookie } }))
    assert.equal(response.status, 200)
    assert.deepEqual(forwardedContext(response)?.memberships.map((row) => row.role), ['driver', 'owner'])
  })
  await withMockSupabase({ mustChangePin: true }, async ({ cookie, calls }) => {
    const response = await updateSession(new NextRequest('http://localhost/trips', { headers: { cookie } }))
    assert.equal(new URL(response.headers.get('location')!).pathname, '/settings')
    assert.equal(calls.filter((url) => url.includes('/rest/v1/memberships')).length, 0)
    const settings = await updateSession(new NextRequest('http://localhost/settings', { headers: { cookie } }))
    assert.equal(forwardedContext(settings)?.user.user_metadata.must_change_pin, true)
  })
  await withMockSupabase({ isAdmin: false }, async ({ cookie }) => {
    const response = await updateSession(new NextRequest('http://localhost/admin', { headers: { cookie } }))
    assert.equal(new URL(response.headers.get('location')!).pathname, '/dashboard')
  })
  await withMockSupabase({ isAdmin: true }, async ({ cookie }) => {
    const response = await updateSession(new NextRequest('http://localhost/admin', { headers: { cookie } }))
    assert.equal(response.status, 200)
    assert.equal(forwardedContext(response), null)
  })
})

test('failed membership reads and oversized profiles cannot forward a spoofed snapshot', async () => {
  for (const options of [{ membershipError: true }, { oversized: true }]) {
    await withMockSupabase(options, async ({ cookie }) => {
      const response = await updateSession(new NextRequest('http://localhost/trips', { headers: { cookie, [FLEET_CONTEXT_HEADER]: 'forged' } }))
      assert.equal(response.status, 200)
      assert.equal(forwardedContext(response), null)
    })
  }
  const user = { id: userId, user_metadata: { full_name: 'x'.repeat(5000) } } as unknown as User
  assert.equal(encodeFleetContext({ user, memberships: [] }), null)
})

test('signed-out requests are redirected even with a forged snapshot', async () => {
  await withMockSupabase({}, async () => {
    const response = await updateSession(new NextRequest('http://localhost/dashboard', { headers: { [FLEET_CONTEXT_HEADER]: 'forged' } }))
    assert.equal(new URL(response.headers.get('location')!).pathname, '/login')
    const admin = await updateSession(new NextRequest('http://localhost/admin', { headers: { [FLEET_CONTEXT_HEADER]: 'forged' } }))
    assert.equal(new URL(admin.headers.get('location')!).pathname, '/admin-login')
  })
})
