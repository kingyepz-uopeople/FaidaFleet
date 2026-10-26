'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  // There is no /error route, and a failed sign-out must never trap the user
  // in the console. Log it, clear the cached tree and send them to /login.
  if (error) {
    console.error('Sign out failed:', error.message)
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
