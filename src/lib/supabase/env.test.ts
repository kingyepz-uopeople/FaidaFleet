import assert from 'node:assert/strict'
import test from 'node:test'
import { getSupabaseKey, getSupabaseUrl, hasSupabaseEnv, supabaseCredentials } from './env'

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = new Map<string, string | undefined>()
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, process.env[name])
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  try {
    run()
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

test('publishable key is preferred over the anon key', () => {
  withEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test',
  }, () => {
    assert.equal(getSupabaseUrl(), 'https://example.supabase.co')
    assert.equal(getSupabaseKey(), 'sb_publishable_test')
    assert.equal(hasSupabaseEnv(), true)
    assert.deepEqual(supabaseCredentials(), {
      url: 'https://example.supabase.co',
      key: 'sb_publishable_test',
    })
  })
})

test('anon key is used when the publishable key is absent', () => {
  withEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test',
  }, () => {
    assert.equal(getSupabaseKey(), 'anon-test')
  })
})

test('missing public env does not throw and uses a build placeholder', () => {
  withEnv({
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
  }, () => {
    assert.equal(hasSupabaseEnv(), false)
    const credentials = supabaseCredentials()
    assert.ok(credentials.url)
    assert.ok(credentials.key)
  })
})
