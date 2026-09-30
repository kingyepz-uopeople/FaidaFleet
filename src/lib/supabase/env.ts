const BUILD_URL = 'https://placeholder.supabase.co'
const BUILD_KEY = 'public-build-placeholder'

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  return url || undefined
}

export function getSupabaseKey() {
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim()
  return key || undefined
}

export function hasSupabaseEnv() {
  return Boolean(getSupabaseUrl() && getSupabaseKey())
}

// Static page generation constructs a client before Vercel inlines the public
// env. A placeholder keeps that step from failing the build. A real request
// still needs the URL and the publishable or anon key.
export function supabaseCredentials() {
  const url = getSupabaseUrl()
  const key = getSupabaseKey()
  if (url && key) return { url, key }
  return {
    url: url || BUILD_URL,
    key: key || BUILD_KEY,
  }
}
