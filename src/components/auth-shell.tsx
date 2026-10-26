import type { ReactNode } from 'react'
import { Car } from '@/components/icons'
import { cn } from '@/lib/utils'

export function AuthShell({
  children,
  variant = 'fleet',
  headline,
  subhead,
}: {
  children: ReactNode
  variant?: 'fleet' | 'admin'
  headline?: string
  subhead?: string
}) {
  const accent = variant === 'admin' ? 'from-rose-700 via-rose-800 to-slate-900' : 'from-slate-900 via-[#1e3a5f] to-slate-800'

  return (
    <div className="flex min-h-dvh bg-background">
      <div className={cn('relative hidden w-[42%] overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between', `bg-gradient-to-br ${accent}`)}>
        <div className="relative z-10">
          <div className="mb-10 flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-2.5">
              <Car className="h-7 w-7" />
            </div>
            <span className="text-2xl font-semibold tracking-tight">FaidaFleet</span>
          </div>
          <h1 className="max-w-sm text-4xl font-semibold leading-tight">
            {headline || 'Fleet money, on every phone.'}
          </h1>
          <p className="mt-4 max-w-sm text-base text-white/80">
            {subhead || 'Collections, trips, and drivers for matatu and logistics operators in Kenya.'}
          </p>
        </div>
        <p className="relative z-10 text-sm text-white/60">Built for Kenyan fleets</p>
      </div>
      <div className="flex min-h-dvh w-full flex-1 items-center justify-center px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
