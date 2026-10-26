'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { isDriverOnly, primaryMembership } from '@/lib/fleet-access'
import { needsPinChange } from '@/lib/pin'
import { createClient } from '@/lib/supabase/client'

export type FleetAccess = {
  loading: boolean
  user: User | null
  /** Primary role across all active memberships (owner > admin > accountant > driver). */
  role: string | null
  /** True only when every active membership is a driver membership. */
  isDriver: boolean
  mustChangePin: boolean
  tenantId: string | null
  driverId: string | null
  driverName: string | null
  vehicleId: string | null
  vehicleLabel: string | null
  loadError: string | null
  refresh: () => Promise<void>
}

const INITIAL: FleetAccess = {
  loading: true,
  user: null,
  role: null,
  isDriver: false,
  mustChangePin: false,
  tenantId: null,
  driverId: null,
  driverName: null,
  vehicleId: null,
  vehicleLabel: null,
  loadError: null,
  refresh: async () => undefined,
}

const FleetAccessContext = createContext<FleetAccess>(INITIAL)

export function useFleetAccess(): FleetAccess {
  return useContext(FleetAccessContext)
}

export function FleetAccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FleetAccess>(INITIAL)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setState({ ...INITIAL, loading: false, loadError: userError?.message || null })
      return
    }

    // Arrays, never .single()/.maybeSingle(): memberships can be plural.
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (membershipError) {
      setState({
        ...INITIAL,
        loading: false,
        user,
        mustChangePin: needsPinChange(user),
        loadError: membershipError.message,
      })
      return
    }

    const primary = primaryMembership(memberships)
    const driver = isDriverOnly(memberships)
    let next: FleetAccess = {
      ...INITIAL,
      loading: false,
      user,
      role: primary?.role || null,
      isDriver: driver,
      mustChangePin: needsPinChange(user),
      tenantId: primary?.tenant_id || null,
    }

    if (driver) {
      const { data: driverRows, error: driverError } = await supabase
        .from('drivers')
        .select('id, tenant_id, full_name')
        .eq('user_id', user.id)
      const ownDriver = (driverRows || []).find((row) => row.tenant_id === primary?.tenant_id) || driverRows?.[0]

      if (driverError) {
        next = { ...next, loadError: driverError.message }
      } else if (!ownDriver) {
        next = {
          ...next,
          loadError: 'Your fleet owner still needs to link your phone number to your driver record.',
        }
      } else {
        const { data: assignments, error: assignmentError } = await supabase
          .from('driver_assignments')
          .select('vehicle_id, tenant_id, is_current')
          .eq('driver_id', ownDriver.id)
          .eq('is_current', true)
        const assignment =
          (assignments || []).find((row) => row.tenant_id === primary?.tenant_id) || assignments?.[0]

        let vehicleLabel: string | null = null
        if (assignment?.vehicle_id) {
          const { data: vehicles } = await supabase
            .from('vehicles')
            .select('id, registration_number')
            .eq('id', assignment.vehicle_id)
            .limit(1)
          vehicleLabel = vehicles?.[0]?.registration_number || null
        }

        next = {
          ...next,
          driverId: ownDriver.id,
          driverName: ownDriver.full_name,
          vehicleId: assignment?.vehicle_id || null,
          vehicleLabel,
          loadError: assignmentError
            ? assignmentError.message
            : !assignment?.vehicle_id
              ? 'Your fleet owner has not assigned you a current vehicle yet. Ask them to add an assignment.'
              : null,
        }
      }
    }

    setState(next)
  }, [supabase])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!active) return
      await load()
    }
    run()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void run()
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [load, supabase])

  const value = useMemo<FleetAccess>(() => ({ ...state, refresh: load }), [state, load])
  return <FleetAccessContext.Provider value={value}>{children}</FleetAccessContext.Provider>
}
