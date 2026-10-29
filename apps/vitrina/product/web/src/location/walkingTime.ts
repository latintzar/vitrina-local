/**
 * Walking-time estimator — core to Vitrina's "buy this recipe from
 * shops you can walk to" promise. Used by the shop matcher (which
 * picks the per-ingredient shop based on stock × walking distance ×
 * price) and by the recipe modal to render the per-shop walk pill.
 *
 * Implementation: Haversine distance × 1.3 detour factor ÷ 4.5 km/h
 * average pace. We deliberately avoid Mapbox Directions Matrix calls
 * here — recomputing on every render or every ingredient match would
 * burn quota fast, and the 1.3 detour factor is empirically within
 * ~10% of real Sofia walking routes for distances under 2 km.
 *
 * If we ever want street-true times we'd cache a Directions response
 * per (user_lat, user_lng, shop_id) tuple in Supabase and fall back
 * to this Haversine formula on cache miss — the `walkingMinutes`
 * signature stays the same so call sites don't change.
 */

const EARTH_R_KM = 6371;
const DETOUR_FACTOR = 1.3;
const PACE_KMH = 4.5;

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkingMinutes(from: LatLng, to: LatLng): number {
  const km = haversineKm(from, to) * DETOUR_FACTOR;
  return Math.max(1, Math.round((km / PACE_KMH) * 60));
}

export function formatWalkingTime(minutes: number): string {
  if (minutes < 1) return '<1 min walk';
  if (minutes < 60) return `${minutes} min walk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h walk` : `${h}h ${m}m walk`;
}
