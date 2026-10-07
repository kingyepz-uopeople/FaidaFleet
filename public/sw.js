// FaidaFleet Service Worker
// Strategy:
//   - Precache: /offline + icons
//   - Navigation: network-first → /offline fallback
//   - Static assets (/_next/static/*, icons, fonts): cache-first
//   - Supabase / auth / POST / Authorization: network-only (never cached)

const CACHE_VERSION = 'v1'
const STATIC_CACHE = `faidafleet-static-${CACHE_VERSION}`
const NAV_CACHE = `faidafleet-nav-${CACHE_VERSION}`
const ALL_CACHES = [STATIC_CACHE, NAV_CACHE]

const PRECACHE_URLS = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ─── Helpers ────────────────────────────────────────────────────────────────
function shouldBypassCache(request) {
  const url = new URL(request.url)

  // Never cache non-GET
  if (request.method !== 'GET') return true

  // Never cache Supabase API / auth
  if (url.hostname.includes('supabase.co')) return true

  // Never cache our auth routes
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) return true

  // Never cache requests with Authorization header
  if (request.headers.get('Authorization')) return true

  return false
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(woff2?|ttf|otf|eot)$/)
  )
}

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Bypass: non-GET, Supabase, auth, Authorization header
  if (shouldBypassCache(request)) return

  // Static assets (Next.js chunks, icons, fonts) → cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      })
    )
    return
  }

  // Navigation requests → network-first, fallback to /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline'))
    )
    return
  }
})
