// Where the sun is, and when it crosses a given altitude. Low-precision
// formulae (after Meeus, by way of NOAA and SunCalc): good to a minute or
// so, which is as good as sunrise times get once the atmosphere's involved.

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const J0 = 0.0009;
const OBLIQUITY = RAD * 23.4397;

const toDays = (ms: number) => ms / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (j: number) => (j + 0.5 - J1970) * DAY_MS;

const meanAnomaly = (d: number) => RAD * (357.5291 + 0.98560028 * d);

function eclipticLongitude(m: number, d: number): number {
  const centre = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  // Perihelion drifts (mostly precession), so the mean longitude advances
  // 36000.77° a century against the equinox of date: Meeus, ch. 25
  return m + centre + RAD * (102.9372 + (1.7198 * d) / 36525) + Math.PI;
}

const declination = (l: number) => Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
const rightAscension = (l: number) => Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY), Math.cos(l));

/** Altitudes (degrees) that define sunrise, the three twilights and golden hour. */
export const ALTITUDES = {
  // Golden hour is when the sun is below this (and above -4°)
  golden: 6,
  // Upper limb on the horizon, with 34' of refraction
  day: -0.833,
  civil: -6,
  nautical: -12,
  astronomical: -18,
} as const;
export type Level = keyof typeof ALTITUDES;
export const LEVELS = Object.keys(ALTITUDES) as Level[];

/**
 * When the sun is above an altitude during one day: rise and set as UTC
 * milliseconds, or "up" (all day, as in polar summer) or "down" (not at all).
 */
export type Crossing = { rise: number; set: number } | 'up' | 'down';

export interface SolarDay {
  /** Solar noon, UTC ms */
  noon: number;
  /** Declination in degrees */
  declination: number;
  crossings: Record<Level, Crossing>;
}

/**
 * The solar day nearest `ms` at a longitude: solar noon and when the sun
 * crosses each altitude in ALTITUDES. Pass something near local noon.
 */
export function solarDay(ms: number, lat: number, lng: number): SolarDay {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(ms);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));

  const transit = (ha: number) => {
    const ds = J0 + (ha + lw) / (2 * Math.PI) + n;
    const m = meanAnomaly(ds);
    const l = eclipticLongitude(m, ds);
    return J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  };

  const ds = J0 + lw / (2 * Math.PI) + n;
  const dec = declination(eclipticLongitude(meanAnomaly(ds), ds));
  const jNoon = transit(0);

  const crossings = {} as Record<Level, Crossing>;
  for (const level of LEVELS) {
    const h = RAD * ALTITUDES[level];
    const cosH = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (cosH > 1) crossings[level] = 'down';
    else if (cosH < -1) crossings[level] = 'up';
    else {
      const jSet = transit(Math.acos(cosH));
      crossings[level] = { rise: fromJulian(jNoon - (jSet - jNoon)), set: fromJulian(jSet) };
    }
  }
  return { noon: fromJulian(jNoon), declination: dec / RAD, crossings };
}

/**
 * Compass bearing (degrees from north) of sunrise; sunset is 360 minus
 * this. Null if the sun doesn't rise or set.
 */
export function sunriseAzimuth(lat: number, declinationDeg: number): number | null {
  const cosA = Math.sin(RAD * declinationDeg) / Math.cos(RAD * lat);
  return Math.abs(cosA) > 1 ? null : Math.acos(cosA) / RAD;
}

/** The point on Earth where the sun is directly overhead at `ms`. */
export function subsolarPoint(ms: number): { lat: number; lng: number } {
  const d = toDays(ms);
  const l = eclipticLongitude(meanAnomaly(d), d);
  const siderealGreenwich = RAD * (280.16 + 360.9856235 * d);
  let lng = (rightAscension(l) - siderealGreenwich) / RAD;
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat: declination(l) / RAD, lng };
}

export type SeasonEvent = 'March equinox' | 'June solstice' | 'September equinox' | 'December solstice';
const SEASONS: SeasonEvent[] = ['March equinox', 'June solstice', 'September equinox', 'December solstice'];

/** The sun's ecliptic longitude, measured from the March equinox, in quarter turns. */
function quarter(ms: number): number {
  const d = toDays(ms);
  const turns = eclipticLongitude(meanAnomaly(d), d) / (2 * Math.PI);
  return (((turns % 1) + 1) % 1) * 4;
}

/** Equinoxes and solstices in a year, to within a quarter of an hour or so. */
export function seasons(year: number): { event: SeasonEvent; at: number }[] {
  const found: { event: SeasonEvent; at: number }[] = [];
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  for (let t = start; t < end; t += DAY_MS) {
    const a = quarter(t);
    const b = quarter(t + DAY_MS);
    // Crossing an integer, or wrapping from ~3.99 to ~0
    const k = Math.floor(b);
    if (Math.floor(a) === k) continue;
    let lo = t;
    let hi = t + DAY_MS;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const q = quarter(mid);
      if (Math.floor(q) === k && !(k === 0 && q > 3)) hi = mid;
      else lo = mid;
    }
    found.push({ event: SEASONS[k % 4], at: hi });
  }
  return found;
}

/** Nearest sunrise or sunset on either side of an instant, including polar seasons. */
export function surroundingSunEvents(ms: number, lat: number, lng: number) {
  type Event = { name: 'Sunrise' | 'Sunset'; at: number };
  const current = solarDay(ms, lat, lng).crossings.day;
  const isDay = current === 'up' || (typeof current === 'object' && ms >= current.rise && ms < current.set);
  const previousName = isDay ? 'Sunrise' : 'Sunset';
  const nextName = isDay ? 'Sunset' : 'Sunrise';
  let previous: Event | undefined;
  let next: Event | undefined;
  // Looking a year in either direction also covers months of polar day/night.
  for (let offset = 0; offset <= 370; offset++) {
    for (const direction of offset === 0 ? [0] : [-offset, offset]) {
      const crossing = solarDay(ms + direction * DAY_MS, lat, lng).crossings.day;
      if (typeof crossing === 'string') continue;
      for (const event of [
        { name: 'Sunrise', at: crossing.rise },
        { name: 'Sunset', at: crossing.set },
      ] as const) {
        if (event.name === previousName && event.at <= ms && (!previous || event.at > previous.at)) previous = event;
        if (event.name === nextName && event.at > ms && (!next || event.at < next.at)) next = event;
      }
    }
    // Include the adjacent solar days, even if today's two events bracket ms.
    if (offset >= 1 && previous && next) break;
  }
  return { previous, next };
}
