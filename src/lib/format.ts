import { type IsoDate, utcNoon } from './tz.ts';

const cache = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

/** A clock time at an instant, in the place's time zone. */
export const formatTime = (ms: number, timeZone: string, locale: string) =>
  formatter(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(ms);

/** A clock time from minutes after midnight (for axes). */
export const formatClock = (minutes: number, locale: string, short = false) =>
  formatter(
    locale,
    short ? { hour: 'numeric', timeZone: 'UTC' } : { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' },
  ).format(Date.UTC(2000, 0, 1, 0, Math.round(minutes)));

export const formatDate = (date: IsoDate, locale: string, options: Intl.DateTimeFormatOptions) =>
  formatter(locale, { ...options, timeZone: 'UTC' }).format(utcNoon(date));

export const formatTimeZoneName = (ms: number, timeZone: string, locale: string) =>
  formatter(locale, { timeZone, timeZoneName: 'short' })
    .formatToParts(ms)
    .find((p) => p.type === 'timeZoneName')?.value ?? timeZone;

/** 9h 56m */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** +3m 42s, −58s */
export function formatDelta(minutes: number): string {
  const sign = minutes > 0 ? '+' : minutes < 0 ? '−' : '±';
  const s = Math.round(Math.abs(minutes) * 60);
  return s >= 60 ? `${sign}${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${sign}${s}s`;
}

const WINDS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (degrees: number) => WINDS[Math.round(degrees / 22.5) % 16];
