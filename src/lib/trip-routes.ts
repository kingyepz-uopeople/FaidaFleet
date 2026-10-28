export type TripRoute = {
  id: string;
  tenant_id: string;
  origin: string;
  destination: string;
  distance_km: number;
  is_active: boolean;
  sort_order: number;
};

export function routeLabel(route: Pick<TripRoute, 'origin' | 'destination' | 'distance_km'>) {
  return `${route.origin} to ${route.destination} (${Number(route.distance_km)} km)`;
}

export function routeFields(route?: TripRoute) {
  return {
    startLocation: route?.origin ?? '',
    endLocation: route?.destination ?? '',
    distanceKm: route ? String(route.distance_km) : '',
  };
}

export function rememberedRoute(routes: TripRoute[], id: string | null) {
  return routes.find((route) => route.id === id && route.is_active);
}

export function routeStorageKey(tenantId: string, userId: string) {
  return `faidafleet:last-trip-route:${tenantId}:${userId}`;
}

export function validRouteDistance(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 999999.99;
}

export function missingTripRoutes(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}
