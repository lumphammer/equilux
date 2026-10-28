// A table of sunlight for a place over a range of dates, in local time.

import { LEVELS, type Level, type SeasonEvent, seasons, solarDay, sunriseAzimuth } from './sun.ts';
import { addDays, daysBetween, type IsoDate, minuteOfDay, offsetMinutes, parseIsoDate } from './tz.ts';

export interface Location {
  lat: number;
  lng: number;
  timeZone: string;
}

/** Local clock minutes after midnight. Can stray outside 0–1440 when an event falls on the neighbouring date. */
export type Minutes = number;

export type LocalCrossing = { rise: number; set: number; riseMin: Minutes; setMin: Minutes } | 'up' | 'down';

export interface DayRow {
  date: IsoDate;
  /** Minutes ahead of UTC at local noon */
  offset: number;
  noon: number;
  noonMin: Minutes;
  crossings: Record<Level, LocalCrossing>;
  /** Minutes of daylight, sunrise to sunset */
  dayLength: number;
  /** How high the sun gets, degrees */
  noonAltitude: number;
  /** Bearing of sunrise from north (sunset is 360 minus it), or null */
  riseAzimuth: number | null;
  /** The clocks changed since the previous day: minutes they moved by */
  clockChange: number;
  season?: SeasonEvent;
  /** Nearest calendar day to a crossing of 12 hours of daylight. */
  equilux?: boolean;
}

export function daylightRows(place: Location, from: IsoDate, to: IsoDate): DayRow[] {
  const rows: DayRow[] = [];
  const count = daysBetween(from, to) + 1;
  const events = seasonsByDate(place.timeZone, parseIsoDate(from)[0], parseIsoDate(to)[0]);

  let previousOffset: number | undefined;
  // Include neighbouring days so equilux detection is independent of the requested range.
  for (let i = -1; i <= count; i++) {
    const date = addDays(from, i);
    const [y, m, d] = parseIsoDate(date);
    // Roughly local solar noon; picks the right solar day for any longitude
    const near = Date.UTC(y, m - 1, d, 12) - (place.lng / 15) * 3_600_000;
    const sun = solarDay(near, place.lat, place.lng);
    const offset = offsetMinutes(sun.noon, place.timeZone);
    const minutes = (ms: number) =>
      (ms - sun.noon) / 60_000 +
      minuteOfDay(sun.noon, place.timeZone) +
      // Clocks may change between noon and the event
      (offsetMinutes(ms, place.timeZone) - offset);

    const crossings = {} as Record<Level, LocalCrossing>;
    for (const level of LEVELS) {
      const c = sun.crossings[level];
      crossings[level] = typeof c === 'string' ? c : { ...c, riseMin: minutes(c.rise), setMin: minutes(c.set) };
    }
    const day = crossings.day;
    const dayLength = day === 'up' ? 1440 : day === 'down' ? 0 : (day.set - day.rise) / 60_000;

    rows.push({
      date,
      offset,
      noon: sun.noon,
      noonMin: minutes(sun.noon),
      crossings,
      dayLength,
      noonAltitude: 90 - Math.abs(place.lat - sun.declination),
      riseAzimuth: typeof day === 'string' ? null : sunriseAzimuth(place.lat, sun.declination),
      clockChange: previousOffset === undefined ? 0 : offset - previousOffset,
      season: events.get(date),
    });
    previousOffset = offset;
  }
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (typeof a.crossings.day !== 'object' || typeof b.crossings.day !== 'object') continue;
    const before = a.dayLength - 720;
    const after = b.dayLength - 720;
    if ((before < 0 && after >= 0) || (before > 0 && after <= 0)) {
      // A calendar date cannot usually have exactly 12 hours; choose the closer day.
      (Math.abs(before) <= Math.abs(after) ? a : b).equilux = true;
    }
  }
  return rows.slice(1, -1);
}

function seasonsByDate(timeZone: string, fromYear: number, toYear: number) {
  const byDate = new Map<IsoDate, SeasonEvent>();
  for (let y = fromYear; y <= toYear; y++) {
    for (const { event, at } of seasons(y)) {
      const local = new Date(at + offsetMinutes(at, timeZone) * 60_000);
      byDate.set(local.toISOString().slice(0, 10), event);
    }
  }
  return byDate;
}

/** Local clock intervals (minutes, clipped to the day) when the sun is above a level. */
export function intervals(c: LocalCrossing): [Minutes, Minutes][] {
  if (c === 'up') return [[0, 1440]];
  if (c === 'down') return [];
  const { riseMin: a, setMin: b } = c;
  // Days near the poles, or in time zones far from solar time, can run
  // across midnight; wrap the overhang onto the other end of the day.
  const parts: [number, number][] = [];
  const add = (x: number, y: number) => {
    const lo = Math.max(0, x);
    const hi = Math.min(1440, y);
    if (hi > lo) parts.push([lo, hi]);
  };
  add(a, b);
  if (a < 0) add(a + 1440, b + 1440);
  if (b > 1440) add(a - 1440, b - 1440);
  return parts;
}
