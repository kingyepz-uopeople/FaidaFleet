import { NextResponse } from 'next/server'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BUCKET = 'fuel-pump-photos'
const BATCH_SIZE = 100
const MAX_BATCHES = 10

type ExpiredPhoto = { id: string; pump_photo_path: string | null }

/**
 * Daily Storage-API cleanup. Vercel supplies Authorization: Bearer CRON_SECRET;
 * x-cron-secret is also accepted for secured manual invocation. The service key
 * stays in this server-only route and is never returned to the browser.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim() || ''
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (!isCronRequestAuthorized(
    request.headers.get('authorization'),
    request.headers.get('x-cron-secret'),
    cronSecret,
  )) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY or Supabase URL is not configured' },
      { status: 500 },
    )
  }

  const now = new Date().toISOString()
  const failedIds: string[] = []
  const errors: { id: string; message: string }[] = []
  let purged = 0

  try {
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      let query = supabase
        .from('expenses')
        .select('id, pump_photo_path')
        .eq('category', 'fuel')
        .not('pump_photo_path', 'is', null)
        .is('pump_photo_deleted_at', null)
        .not('pump_photo_expires_at', 'is', null)
        .lte('pump_photo_expires_at', now)
        .order('pump_photo_expires_at', { ascending: true })
        .limit(BATCH_SIZE)

      // A failed deletion stays in the database for the next daily run, but is
      // excluded from later batches in this invocation to avoid a tight loop.
      if (failedIds.length > 0) query = query.not('id', 'in', `(${failedIds.join(',')})`)
      const { data: rows, error } = await query
      if (error) throw error
      if (!rows || rows.length === 0) break

      const results = await Promise.all((rows as ExpiredPhoto[]).map(async (row) => {
        if (!row.pump_photo_path) return { id: row.id, ok: true as const }

        // Delete the real file first. A missing object is also success, making
        // retries safe after a previous file-delete/database-update partial run.
        const { error: storageError } = await supabase.storage
          .from(BUCKET)
          .remove([row.pump_photo_path])
        if (storageError) {
          return { id: row.id, ok: false as const, message: storageError.message }
        }

        const { data: updated, error: updateError } = await supabase
          .from('expenses')
          .update({ pump_photo_deleted_at: now, pump_photo_path: null })
          .eq('id', row.id)
          .is('pump_photo_deleted_at', null)
          .select('id')
        if (updateError) {
          return { id: row.id, ok: false as const, message: updateError.message }
        }
        return { id: row.id, ok: true as const, changed: (updated || []).length }
      }))

      for (const result of results) {
        if (result.ok) {
          if ('changed' in result && (result.changed || 0) > 0) purged += 1
        } else {
          failedIds.push(result.id)
          errors.push({ id: result.id, message: result.message })
        }
      }

      if (rows.length < BATCH_SIZE) break
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Could not purge fuel photos',
      purged,
      failed: errors.length,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: errors.length === 0,
    purged,
    failed: errors.length,
    errors: errors.slice(0, 10),
  }, { status: errors.length > 0 ? 500 : 200 })
}

export const POST = GET
