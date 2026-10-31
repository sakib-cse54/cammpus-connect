/** Mean Earth radius in metres (IUGG). */
const EARTH_RADIUS_M = 6371008.8;
/** GPS accuracy above this is not credited when widening the geofence. */
export const MAX_ACCURACY_CREDIT_M = 100;

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two WGS84 points (Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when the reported position is outside radius + min(accuracy, 100). */
export function isOutOfRange(distanceM: number, radiusM: number, accuracyM: number | undefined): boolean {
  const credit = Math.min(Math.max(accuracyM ?? 0, 0), MAX_ACCURACY_CREDIT_M);
  return distanceM > radiusM + credit;
}
