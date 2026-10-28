import { type Place, placePath } from './place.ts';
import { isValidTimeZone } from './tz.ts';

export const FAVOURITES_KEY = 'equilux:favourites';
export const FAVOURITE_NAME_LIMIT = 120;
export interface Favourite {
  name: string;
  place: Place;
}

/** Names are aliases; identity stays tied to the original place or coordinates. */
export const favouriteKey = (place: Place) => (place.id ? `place:${place.id}` : placePath(place));

function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === 'string' &&
    typeof p.label === 'string' &&
    typeof p.lat === 'number' &&
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lng) <= 180 &&
    typeof p.timeZone === 'string' &&
    isValidTimeZone(p.timeZone) &&
    (p.id === undefined || (typeof p.id === 'number' && Number.isSafeInteger(p.id) && p.id > 0)) &&
    (p.population === undefined || (typeof p.population === 'number' && Number.isFinite(p.population))) &&
    (p.near === undefined ||
      (p.near !== null &&
        typeof p.near === 'object' &&
        typeof (p.near as Place['near'])?.label === 'string' &&
        typeof (p.near as Place['near'])?.km === 'number' &&
        typeof (p.near as Place['near'])?.id === 'number'))
  );
}

/** Ignore corrupt entries, without letting one bad entry hide other saved places. */
export function parseFavourites(value: string | null): Favourite[] {
  let data: unknown;
  try {
    data = JSON.parse(value ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  return data.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.name !== 'string' || !item.name.trim() || !isPlace(item.place)) return [];
    const key = favouriteKey(item.place);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name: item.name.trim().slice(0, FAVOURITE_NAME_LIMIT), place: item.place }];
  });
}
