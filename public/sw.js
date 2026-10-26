/**
 * FaidaFleet service worker — offline shell only.
 *
 * Single PWA stack: Next.js manifest.webmanifest + /offline page + RegisterSW.
 *
 * Rules (deliberately conservative):
 * - Only content-hashed app-shell assets are cached (offline page, icons,
 *   /_next/static bundles). They are immutable.
 * - HTML navigations are NEVER cached. Every page in this app renders
 *   session-dependent data, so a cached page would show one user's data to the
 *   next person on the device. Navigations go to the network, and fall back to
 *   /offline only when the network is unavailable.
 * - API routes, /auth/*, Supabase requests, non-GET and cross-origin requests
 *   are never intercepted. Auth and live data always hit the network.
 *
 * Bump VERSION whenever the caching behaviour changes so old caches are purged.
 */
const VERSION = 'v4'
const STATIC_CACHE = `faidafleet-static-${VERSION}`
const ASSETS_CACHE = `faidafleet-assets-${VERSION}`
const KNOWN_CACHES = [STATIC_CACHE, ASSETS_CACHE]

const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/favicon.ico',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      // Cache each asset individually so one failure doesn't abort the rest.
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          const response = await fetch(url, { cache: 'reload' })
          if (response.ok) await cache.put(url, response)
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          // v3 cached HTML pages under faidafleet-pages-v3 and older builds
          // cached under other prefixes; drop everything we no longer know.
          .filter((key) => key.startsWith('faidafleet-') && !KNOWN_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf)$/.test(pathname)
  )
}

async function networkOnlyNavigation(request) {
  try {
    return await fetch(request, { cache: 'no-store' })
  } catch {
    const offlinePage = await caches.match(OFFLINE_URL)
    if (offlinePage) return offlinePage
    return new Response('You are offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(ASSETS_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle same-origin GET requests. Everything else (Supabase API,
  // auth, form posts, analytics…) goes straight to the network.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/auth/')) return
  if (url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(networkOnlyNavigation(request))
    return
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
  }
  // Anything else is left to the browser — no stale session data.
})
