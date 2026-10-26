'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'
import { EmptyState, LoadingState } from '@/components/page-shell'

type PinResetRow = {
  id: string
  actor_user_id: string
  actor_role: string
  target_kind: string
  target_user_id: string | null
  target_driver_id: string | null
  tenant_id: string | null
  created_at: string
}

export default function PinResetsPage() {
  const [rows, setRows] = useState<PinResetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data, error: loadError } = await supabase
        .from('pin_reset_log')
        .select('id, actor_user_id, actor_role, target_kind, target_user_id, target_driver_id, tenant_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (loadError) {
        setError(
          loadError.message.includes('pin_reset_log')
            ? 'Run supabase/migrations/008_pin_reset_log.sql, then refresh this page.'
            : loadError.message,
        )
      } else {
        setRows((data || []) as PinResetRow[])
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">PIN resets</h1>
        <p className="text-sm text-muted-foreground">Recent PIN set and reset events. PINs themselves are never stored or shown here.</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Last 50 events</CardTitle>
          <CardDescription>Who reset whose login, and when.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState title="No PIN resets yet" description="When a fleet owner or system admin sets a PIN, it appears here." />
          ) : (
            <ul className="divide-y">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {row.actor_role.replace('_', ' ')} reset a {row.target_kind.replace('_', ' ')} PIN
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Actor {row.actor_user_id.slice(0, 8)}
                      {row.tenant_id ? ` · fleet ${row.tenant_id.slice(0, 8)}` : ''}
                      {row.target_driver_id ? ` · driver ${row.target_driver_id.slice(0, 8)}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
