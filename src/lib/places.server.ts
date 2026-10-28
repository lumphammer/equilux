// Place lookups in D1. Server only.

import { env } from 'cloudflare:workers';
import { normalise, normaliseLoose } from './normalise.ts';
import { distanceKm, formatCoordinates, type Place } from './place.ts';
import { isValidTimeZone, nauticalTimeZone } from './tz.ts';

const COLUMNS = `p.geonameid AS id, p.name, p.label, p.country, p.latitude AS lat,
  p.longitude AS lng, p.population, p.timezone AS timeZone`;

type Row = Required<Omit<Place, 'near'>>;

export async function findPlace(id: number): Promise<Place | null> {
  return env.DB.prepare(`SELECT ${COLUMNS} FROM places p WHERE geonameid = ?`).bind(id).first<Row>();
}

/**
 * Places whose names start with the query, best first: exact matches
 * (in the visitor's country first, then places actually called that before
 * ones that merely have it as an alternative name), then the rest by
 * population.
 * "Paris, Texas" narrows by region or country. Falls back to a looser match
 * for misspellings.
 */
export async function searchPlaces(query: string, preferCountry = '', limit = 8): Promise<Place[]> {
  const [namePart, ...rest] = query.split(',');
  const name = normalise(namePart);
  const qualifier = normalise(rest.join(' '));
  if (!name) return [];

  const narrow = qualifier ? 'AND instr(p.qualifiers, ?4) > 0' : '';
  // "exact" ranks a place first: called exactly that, or (for misspellings)
  // matched by its real name. Short alternative names are often airport
  // codes (London and Lognes are both LON), so they don't count.
  const run = (where: string, exact: string, term: string) =>
    env.DB.prepare(
      `SELECT ${COLUMNS}, max(${exact}) AS exact, min(n.alias) AS alias
       FROM place_names n JOIN places p USING (geonameid)
       WHERE ${where} ${narrow}
       GROUP BY p.geonameid
       ORDER BY exact DESC, (exact AND p.country = ?2) DESC, CASE WHEN exact THEN alias END, p.population DESC
       LIMIT ?3`,
    )
      .bind(...[term, preferCountry, limit, ...(qualifier ? [qualifier] : [])])
      .all<Row>();

  // Prefix matches once there's enough to go on; exact matches before that
  const prefix = name.length >= 3;
  const exact = 'n.name = ?1 AND (n.alias = 0 OR length(?1) > 4)';
  let { results } = await run(prefix ? "n.name >= ?1 AND n.name < ?1 || '~'" : 'n.name = ?1', exact, name);
  if (!results.length && prefix) ({ results } = await run('n.loose = ?1', 'n.alias = 0', normaliseLoose(namePart)));
  return results.map(({ exact, alias, ...place }: Row & { exact?: number; alias?: number }) => place);
}

/** The nearest named place to a point, or null if there's none within a few hundred km. */
export async function nearestPlace(lat: number, lng: number): Promise<(Place & { km: number }) | null> {
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
  for (const radius of [0.3, 1.5, 4]) {
    const dLng = Math.min(radius / cos, 180);
    const row = await env.DB.prepare(
      `SELECT ${COLUMNS},
         (p.latitude - ?1) * (p.latitude - ?1) + (p.longitude - ?2) * (p.longitude - ?2) * ?3 AS d2
       FROM places p
       WHERE p.latitude BETWEEN ?1 - ?4 AND ?1 + ?4 AND p.longitude BETWEEN ?2 - ?5 AND ?2 + ?5
       ORDER BY d2 LIMIT 1`,
    )
      .bind(lat, lng, cos * cos, radius, dLng)
      .first<Row & { d2: number }>();
    if (row) {
      const { d2, ...place } = row;
      return { ...place, km: distanceKm(lat, lng, place.lat, place.lng) };
    }
  }
  return null;
}

/** A point on the map, borrowing its time zone from the nearest place if there's one close enough. */
export async function pointPlace(lat: number, lng: number): Promise<Place> {
  const nearest = await nearestPlace(lat, lng);
  const close = nearest && nearest.km < 250;
  return {
    name: close && nearest.km < 1 ? nearest.name : formatCoordinates(lat, lng),
    label: formatCoordinates(lat, lng),
    lat,
    lng,
    timeZone: close ? nearest.timeZone : nauticalTimeZone(lng),
    country: close ? nearest.country : undefined,
    near: nearest ? { label: nearest.label, km: nearest.km, id: nearest.id! } : undefined,
  };
}

export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Where Cloudflare thinks the visitor is, for a first guess. */
export function visitorLocation(request: Request) {
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  const lat = Number(cf?.latitude);
  const lng = Number(cf?.longitude);
  return {
    country: typeof cf?.country === 'string' ? cf.country : '',
    point: Number.isFinite(lat) && Number.isFinite(lng) && cf?.latitude ? { lat, lng } : null,
    timeZone: typeof cf?.timezone === 'string' && isValidTimeZone(cf.timezone) ? cf.timezone : null,
  };
}
