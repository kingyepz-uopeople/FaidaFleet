/**
 * FaidaFleet service worker — offline support.
 *
 * Single PWA stack: Next.js manifest.webmanifest + /offline page + RegisterSW.
 *
 * Strategies:
 * - App shell assets (offline page, icons) are precached on install.
 * - Page navigations are NETWORK ONLY. HTML pages depend on the auth session,
 *   so caching them served stale dashboards and post-logout pages. When the
 *   network is unavailable we show the precached /offline page instead.
 * - Next.js build assets (/_next/static/) and other static files: cache-first
 *   (they are content-hashed / immutable).
 * - Other same-origin, non-document GETs: stale-while-revalidate.
 * - API routes (/api/*), auth routes (/auth/*), non-GET requests and
 *   cross-origin requests (Supabase, fonts…) are never intercepted, so auth
 *   and live data always hit the network.
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
    return await fetch(request)
  } catch {
    // Offline (or DNS failure): never serve a stale authenticated page,
    // only the standalone offline shell.
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

  // Never intercept API/auth traffic, including Supabase auth helpers and
  // the service worker script itself.
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/auth/')) return
  if (url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    // HTML documents carry session state: always go to the network, fall
    // back to the offline shell rather than a cached (possibly stale) page.
    event.respondWith(networkOnlyNavigation(request))
    return
  }

  // Defense in depth: never cache a document response outside navigations.
  if (request.destination === 'document') return

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})
