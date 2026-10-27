// Vercel Cron has no Supabase session. The existing middleware (intentionally
// unchanged) redirects signed-out /api requests to /login, but excludes paths
// ending in .jpg. This alias uses that existing exclusion; it does not weaken
// authentication because the shared handler still requires CRON_SECRET.
export { GET, POST } from '../purge-fuel-photos/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
