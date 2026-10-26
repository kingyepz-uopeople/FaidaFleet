/**
 * FaidaFleet service worker — basic offline support.
 *
 * Strategies:
 * - App shell assets (offline page, icons, manifest) are precached on install.
 * - Page navigations: network-first, falling back to the last cached page
 *   and finally to /offline.html.
 * - Next.js build assets (/_next/static/) and other static files: cache-first
 *   (they are content-hashed / immutable).
 * - Everything else same-origin: stale-while-revalidate.
 * - API routes, non-GET requests and cross-origin requests (Supabase, fonts…)
 *   are never intercepted, so auth and live data always hit the network.
 *
 * Bump VERSION whenever the caching behaviour changes so old caches are purged.
 */
const VERSION = 'v1'
const STATIC_CACHE = `faidafleet-static-${VERSION}`
const PAGES_CACHE = `faidafleet-pages-${VERSION}`
const ASSETS_CACHE = `faidafleet-assets-${VERSION}`
const KNOWN_CACHES = [STATIC_CACHE, PAGES_CACHE, ASSETS_CACHE]

const OFFLINE_URL = '/offline.html'

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
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
        })
      )
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('faidafleet-') && !KNOWN_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
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

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    // Only cache full, direct responses — never cache auth redirects
    // (e.g. /dashboard -> /login) under the requested URL.
    if (response.ok && !response.redirected) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cachedPage = await cache.match(request)
    if (cachedPage) return cachedPage
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

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(ASSETS_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  if (cached) {
    event.waitUntil(network)
    return cached
  }
  return network
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle same-origin GET requests. Everything else (Supabase API,
  // auth, form posts, analytics…) goes straight to the network.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
  } else if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})
