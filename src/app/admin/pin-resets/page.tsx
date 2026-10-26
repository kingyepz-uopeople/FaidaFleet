'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminFeedback, AdminPageHeader, AdminRecordList, AdminSearch, StatusBadge, formatDate, titleCase } from '@/components/admin-ui'
import { isAdminUiPreview, previewPinResets } from '@/lib/admin-preview'

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
  const preview = isAdminUiPreview()
  const [rows, setRows] = useState<PinResetRow[]>(preview ? previewPinResets : [])
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      if (isAdminUiPreview()) {
        setRows(previewPinResets)
        setLoading(false)
        return
      }
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

  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      `${row.actor_role} ${row.target_kind} ${row.actor_user_id} ${row.tenant_id || ''}`.toLowerCase().includes(needle),
    )
  }, [query, rows])

  return (
    <>
      <AdminPageHeader
        title="PIN resets"
        description="Who set or reset a login PIN, and when. PINs themselves are never stored or shown here."
      />
      <AdminFeedback error={error} />
      <AdminSearch value={query} onChange={setQuery} placeholder="Search by role, target, or id…" />
      <AdminRecordList
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No PIN resets yet"
        emptyDescription="When a fleet owner or system admin sets a PIN, it appears here."
        columns={[
          { id: 'event', header: 'Event', cell: (row) => `${titleCase(row.actor_role)} reset a ${row.target_kind.replace('_', ' ')} PIN` },
          { id: 'actor', header: 'Actor', cell: (row) => <span className="font-mono text-xs">{row.actor_user_id.slice(0, 8)}</span> },
          { id: 'target', header: 'Target', cell: (row) => <StatusBadge tone="info">{titleCase(row.target_kind)}</StatusBadge> },
          { id: 'fleet', header: 'Fleet', cell: (row) => row.tenant_id ? <span className="font-mono text-xs">{row.tenant_id.slice(0, 8)}</span> : '—', hideOnMobile: true },
          { id: 'when', header: 'When', cell: (row) => formatDate(row.created_at) },
        ]}
      />
    </>
  )
}
