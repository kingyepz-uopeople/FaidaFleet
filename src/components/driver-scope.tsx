'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

/** Read-only, phone-friendly field for a driver's locked vehicle / driver. */
export function LockedValue({
  id,
  label,
  value,
  hint,
}: {
  id: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        readOnly
        aria-readonly="true"
        className="h-12 bg-muted text-base"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function DriverScopeNotice({ message }: { message: string }) {
  return (
    <Alert>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
