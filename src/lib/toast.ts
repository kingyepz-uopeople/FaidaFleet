'use client'

import { toast } from '@/hooks/use-toast'
import { describeDbError } from '@/lib/db'
import type { PostgrestError } from '@supabase/supabase-js'

/** Shows a destructive toast with a real, human-readable message. */
export function toastError(error: unknown, action = 'Action failed') {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : describeDbError(error as PostgrestError, action) || 'Something went wrong'
  toast({
    variant: 'destructive',
    title: action,
    description: message,
  })
  return message
}

export function toastSuccess(message: string, title = 'Saved') {
  toast({ title, description: message })
}
