'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import {
  accessFromMemberships,
  EMPTY_FLEET_ACCESS_SNAPSHOT,
  fleetAccessPhases,
  type FleetAccessSnapshot,
} from '@/lib/fleet-access'
import { createClient } from '@/lib/supabase/client'

export type FleetAccess = {
  /** Full access (role + tenant + driver scope) is still resolving. */
  loading: boolean
  /** Only the role is unknown; the shell must show a neutral skeleton. */
  roleLoading: boolean
  /** Driver record / current vehicle lookup is still running. */
  scopeLoading: boolean
  user: User | null
  /** The signed-in auth user id, used for recorded_by on inserts. */
  userId: string | null
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

type DriverScope = Pick<
  FleetAccess,
  'driverId' | 'driverName' | 'vehicleId' | 'vehicleLabel' | 'loadError'
>

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000'
const NO_DRIVER_SCOPE: DriverScope = {
  driverId: null,
  driverName: null,
  vehicleId: null,
  vehicleLabel: null,
  loadError: null,
}

function stateFromSnapshot(snapshot: FleetAccessSnapshot): FleetAccess {
  return {
    ...fleetAccessPhases(snapshot),
    user: snapshot.user,
    userId: snapshot.user?.id || null,
    role: snapshot.role,
    isDriver: snapshot.isDriver,
    mustChangePin: snapshot.mustChangePin,
    tenantId: snapshot.tenantId,
    ...NO_DRIVER_SCOPE,
    refresh: async () => undefined,
  }
}

const INITIAL: FleetAccess = stateFromSnapshot(EMPTY_FLEET_ACCESS_SNAPSHOT)

const FleetAccessContext = createContext<FleetAccess>(INITIAL)

export function useFleetAccess(): FleetAccess {
  return useContext(FleetAccessContext)
}

export function FleetAccessProvider({
  children,
  initialAccess = EMPTY_FLEET_ACCESS_SNAPSHOT,
}: {
  children: ReactNode
  initialAccess?: FleetAccessSnapshot
}) {
  const [state, setState] = useState<FleetAccess>(() => stateFromSnapshot(initialAccess))
  // Freeze the server snapshot: a client-side sign-in must not keep reusing it.
  const initialRef = useRef(initialAccess)
  const requestId = useRef(0)
  const supabase = useMemo(() => createClient(), [])

  const apply = useCallback((id: number, patch: Partial<FleetAccess>) => {
    // A sign-out / re-sign-in can happen while earlier queries are in flight.
    if (requestId.current !== id) return
    setState((previous) => ({ ...previous, ...patch }))
  }, [])

  /**
   * Driver scope used to be three sequential requests (driver row, then
   * assignment, then vehicle). RLS already lets a member read tenant rows, so
   * these three reads are independent and can share one round trip.
   */
  const loadDriverScope = useCallback(
    async (userId: string, tenantId: string): Promise<DriverScope> => {
      const [driverRes, assignmentRes, vehicleRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, tenant_id, full_name')
          .eq('user_id', userId),
        supabase
          .from('driver_assignments')
          .select('driver_id, vehicle_id, tenant_id, is_current')
          .eq('tenant_id', tenantId || NO_MATCH_UUID)
          .eq('is_current', true),
        supabase
          .from('vehicles')
          .select('id, registration_number')
          .eq('tenant_id', tenantId || NO_MATCH_UUID),
      ])

      if (driverRes.error) return { ...NO_DRIVER_SCOPE, loadError: driverRes.error.message }

      const driverRows = driverRes.data || []
      const ownDriver =
        driverRows.find((row) => row.tenant_id === tenantId) || driverRows[0]
      if (!ownDriver) {
        return {
          ...NO_DRIVER_SCOPE,
          loadError: 'Your fleet owner still needs to link your phone number to your driver record.',
        }
      }

      const assignments = assignmentRes.data || []
      const assignment =
        assignments.find((row) => row.driver_id === ownDriver.id && row.tenant_id === tenantId) ||
        assignments.find((row) => row.driver_id === ownDriver.id)
      const vehicles = vehicleRes.data || []
      const vehicle = vehicles.find((row) => row.id === assignment?.vehicle_id)

      return {
        driverId: ownDriver.id,
        driverName: ownDriver.full_name,
        vehicleId: assignment?.vehicle_id || null,
        vehicleLabel: vehicle?.registration_number || null,
        loadError:
          assignmentRes.error?.message ||
          vehicleRes.error?.message ||
          (!assignment?.vehicle_id
            ? 'Your fleet owner has not assigned you a current vehicle yet. Ask them to add an assignment.'
            : null),
      }
    },
    [supabase],
  )

  /**
   * `trustSnapshot` is used once on mount, when the server layout already
   * resolved the session + memberships. Auth events and refresh() always do a
   * full client-side read so a new session or cleared PIN flag is picked up.
   */
  const load = useCallback(
    async (options?: { trustSnapshot?: boolean }) => {
      const id = requestId.current + 1
      requestId.current = id
      const snapshot = initialRef.current

      if (options?.trustSnapshot && snapshot.ready && snapshot.user) {
        const base = stateFromSnapshot(snapshot)
        apply(id, {
          user: base.user,
          userId: base.userId,
          role: base.role,
          isDriver: base.isDriver,
          mustChangePin: base.mustChangePin,
          tenantId: base.tenantId,
          loading: base.isDriver,
          roleLoading: false,
          scopeLoading: base.isDriver,
          ...NO_DRIVER_SCOPE,
        })
        if (base.isDriver && base.tenantId && base.userId) {
          const scope = await loadDriverScope(base.userId, base.tenantId)
          apply(id, { ...scope, loading: false, scopeLoading: false })
        } else if (base.isDriver) {
          apply(id, { loading: false, scopeLoading: false })
        }
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        apply(id, {
          ...INITIAL,
          loading: false,
          roleLoading: true,
          loadError: userError?.message || null,
        })
        return
      }

      // Arrays, never .single()/.maybeSingle(): memberships can be plural.
      const { data: memberships, error: membershipError } = await supabase
        .from('memberships')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (membershipError) {
        apply(id, {
          user,
          userId: user.id,
          role: null,
          isDriver: false,
          mustChangePin: accessFromMemberships(null, user).mustChangePin,
          tenantId: null,
          ...NO_DRIVER_SCOPE,
          loadError: membershipError.message,
          loading: false,
          roleLoading: true,
          scopeLoading: false,
        })
        return
      }

      const resolved = accessFromMemberships(memberships, user)
      // Publish the role/tenant as soon as they are known: owner pages can
      // start their own data query while the driver scope finishes. With no
      // membership at all, keep the neutral skeleton instead of "Member".
      apply(id, {
        user,
        userId: user.id,
        role: resolved.role,
        isDriver: resolved.isDriver,
        mustChangePin: resolved.mustChangePin,
        tenantId: resolved.tenantId,
        ...NO_DRIVER_SCOPE,
        loadError: null,
        loading: resolved.isDriver,
        roleLoading: !resolved.ready,
        scopeLoading: resolved.isDriver,
      })

      if (resolved.isDriver && resolved.tenantId) {
        const scope = await loadDriverScope(user.id, resolved.tenantId)
        apply(id, { ...scope, loading: false, scopeLoading: false })
      } else if (resolved.isDriver) {
        apply(id, { loading: false, scopeLoading: false })
      }
    },
    [apply, loadDriverScope, supabase],
  )

  useEffect(() => {
    void load({ trustSnapshot: true })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // The server snapshot already describes this session; re-querying on the
      // initial SIGNED_IN would only duplicate the mount work.
      if (event === 'SIGNED_IN' && session?.user?.id === initialRef.current.user?.id) return
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void load()
      }
    })
    return () => {
      requestId.current += 1
      subscription.unsubscribe()
    }
  }, [load, supabase])

  const refresh = useCallback(() => load(), [load])
  const value = useMemo<FleetAccess>(() => ({ ...state, refresh }), [state, refresh])
  return <FleetAccessContext.Provider value={value}>{children}</FleetAccessContext.Provider>
}
