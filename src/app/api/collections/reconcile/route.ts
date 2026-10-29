import { NextResponse } from 'next/server'
import {
  findReconcileMembership,
  isElectronicCollectionMethod,
  reconcilePatch,
  unreconcilePatch,
  validateReconcileRequest,
} from '@/lib/collections-reconciliation'
import { assertMutation, isUuid } from '@/lib/db'
import { needsPinChange } from '@/lib/pin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tenantId = (searchParams.get('tenantId') || '').trim()
  if (!isUuid(tenantId)) {
    return NextResponse.json({ error: 'Valid fleet ID is required' }, { status: 400 })
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 400 })
  }

  const membership = findReconcileMembership(memberships, tenantId)
  if (!membership) {
    return NextResponse.json(
      { error: 'Only fleet owners and admins can view reconciliation details.' },
      { status: 403 },
    )
  }

  const { data: collectionRows, error: collectionsError } = await supabase
    .from('collections')
    .select('reconciled_by')
    .eq('tenant_id', tenantId)
    .not('reconciled_by', 'is', null)

  if (collectionsError) {
    return NextResponse.json({ error: collectionsError.message }, { status: 400 })
  }

  const userIds = Array.from(
    new Set(
      [
        user.id,
        ...(collectionRows || [])
          .map((row) => row.reconciled_by)
          .filter((id): id is string => Boolean(id)),
      ].filter(isUuid),
    ),
  )

  const reconcilers: Record<string, string> = {}
  const metadataName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
  if (metadataName) {
    reconcilers[user.id] = metadataName
  }

  if (userIds.length > 0) {
    const profileClient = createAdminClient() ?? supabase
    const { data: profiles } = await profileClient
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)

    for (const profile of profiles || []) {
      const fullName = (profile.full_name || '').trim()
      if (fullName) {
        reconcilers[profile.id] = fullName
      }
    }
  }

  return NextResponse.json({ reconcilers })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 400 })
  }

  const validated = validateReconcileRequest({
    userId: user.id,
    mustChangePin: needsPinChange(user),
    memberships,
    body,
  })
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status })
  }

  const { tenantId, action, ids } = validated

  const { data: existingRows, error: readError } = await supabase
    .from('collections')
    .select('id, tenant_id, payment_method, reconciled')
    .eq('tenant_id', tenantId)
    .in('id', ids)

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 })
  }

  if (!existingRows || existingRows.length !== ids.length) {
    return NextResponse.json(
      { error: 'One or more collections were not found in your fleet.' },
      { status: 404 },
    )
  }

  if (existingRows.some((row) => !isElectronicCollectionMethod(row.payment_method))) {
    return NextResponse.json(
      { error: 'Cash collections are recorded directly and do not need reconciling.' },
      { status: 400 },
    )
  }

  try {
    if (action === 'reconcile') {
      const pendingIds = existingRows.filter((row) => !row.reconciled).map((row) => row.id)
      if (pendingIds.length === 0) {
        return NextResponse.json(
          { error: 'The selected collections are already reconciled.' },
          { status: 409 },
        )
      }

      const patch = reconcilePatch(user.id)
      const result = await supabase
        .from('collections')
        .update(patch)
        .eq('tenant_id', tenantId)
        .in('id', pendingIds)
        .in('payment_method', ['mpesa', 'pochi'])
        .select('id, reconciled, reconciled_at, reconciled_by')

      const rows = assertMutation(result, 'Could not reconcile collections', {
        expectsRows: pendingIds.length,
      })

      const profileClient = createAdminClient() ?? supabase
      const { data: profileRows } = await profileClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .limit(1)

      const reconcilerName =
        (profileRows?.[0]?.full_name || '').trim() ||
        (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '') ||
        null

      return NextResponse.json({ rows, reconcilerName })
    }

    const target = existingRows[0]
    if (!target.reconciled) {
      return NextResponse.json({ error: 'This collection is already pending.' }, { status: 409 })
    }

    const patch = unreconcilePatch()
    const result = await supabase
      .from('collections')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', target.id)
      .in('payment_method', ['mpesa', 'pochi'])
      .select('id, reconciled, reconciled_at, reconciled_by')

    const rows = assertMutation(result, 'Could not unreconcile the collection', { expectsRows: 1 })
    return NextResponse.json({ rows, reconcilerName: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update reconciliation status'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
