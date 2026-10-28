// What the client knows about a place. Shared by server and browser.

export interface Place {
  /** GeoNames ID, for named places; absent for a point picked on the map */
  id?: number;
  name: string;
  label: string;
  country?: string;
  lat: number;
  lng: number;
  timeZone: string;
  population?: number;
  /** For map points: the nearest named place */
  near?: { label: string; km: number; id: number };
}

export function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function placePath(place: Place): string {
  if (place.id) return `/place/${place.id}/${slug(place.name)}`;
  return `/at/${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
}

export function formatCoordinates(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
}

/** Great-circle distance in kilometres. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
