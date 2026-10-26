'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AddAdminInput = {
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'moderator'
  permissions: string[]
}

export type AddAdminResult = {
  success: boolean
  error?: string
  message?: string
}

export async function addAdminUser(input: AddAdminInput): Promise<AddAdminResult> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const fullName = input.full_name.trim()
  const role = input.role
  const permissions = input.permissions || []

  if (!normalizedEmail || !fullName) {
    return { success: false, error: 'Email and full name are required.' }
  }

  // 1. Authenticate caller and verify super_admin role
  const supabase = await createClient()
  const {
    data: { user: callerUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !callerUser) {
    return { success: false, error: 'Unauthorized: You must be signed in.' }
  }

  const { data: isAdmin, error: adminRpcError } = await supabase.rpc('is_system_admin')
  if (adminRpcError || !isAdmin) {
    return { success: false, error: 'Unauthorized: System administrator access required.' }
  }

  const { data: callerRecord, error: callerError } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', callerUser.id)
    .eq('is_active', true)
    .single()

  if (callerError || !callerRecord || callerRecord.role !== 'super_admin') {
    return {
      success: false,
      error: 'Forbidden: Only super administrators can add or invite new admin users.',
    }
  }

  // 2. Check service role admin client
  const adminClient = createAdminClient()
  let targetUserId: string | null = null
  let invitedNewUser = false

  if (adminClient) {
    // Check if auth user already exists
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers()
    if (!listError && listData?.users) {
      const existingAuthUser = listData.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      )
      if (existingAuthUser) {
        targetUserId = existingAuthUser.id
      }
    }

    // If user does not exist in Auth, invite them
    if (!targetUserId) {
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
          data: { full_name: fullName },
        })

      if (inviteError) {
        return {
          success: false,
          error: `Failed to invite user via Supabase Auth: ${inviteError.message}`,
        }
      }

      if (inviteData?.user) {
        targetUserId = inviteData.user.id
        invitedNewUser = true
      }
    }
  } else {
    // Service role key not configured on server
    return {
      success: false,
      error:
        'SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please configure it in your environment or follow the manual grant steps in docs/admin-bootstrap.md.',
    }
  }

  // 3. Upsert into public.admin_users
  const { error: upsertError } = await supabase
    .from('admin_users')
    .upsert(
      {
        user_id: targetUserId,
        email: normalizedEmail,
        full_name: fullName,
        role,
        permissions,
        is_active: true,
      },
      { onConflict: 'email' }
    )

  if (upsertError) {
    return {
      success: false,
      error: `Failed to save admin user record: ${upsertError.message}`,
    }
  }

  return {
    success: true,
    message: invitedNewUser
      ? `Invitation sent to ${normalizedEmail} and admin privileges granted.`
      : `Admin privileges granted to existing user ${normalizedEmail}.`,
  }
}
