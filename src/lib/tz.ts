// Calendar dates are 'YYYY-MM-DD' strings throughout; instants are UTC ms.

export type IsoDate = string;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

function wallClock(ms: number, timeZone: string) {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFormatter(timeZone).formatToParts(ms)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Minutes ahead of UTC in a time zone at an instant (60 for BST). */
export function offsetMinutes(ms: number, timeZone: string): number {
  const p = wallClock(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** The local calendar date at an instant. */
export function localDate(ms: number, timeZone: string): IsoDate {
  const p = wallClock(ms, timeZone);
  return isoDate(p.year, p.month, p.day);
}

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseIsoDate(date: IsoDate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

/** Midday UTC on a date: a handy instant for date arithmetic. */
export const utcNoon = (date: IsoDate) => {
  const [y, m, d] = parseIsoDate(date);
  return Date.UTC(y, m - 1, d, 12);
};

export function addDays(date: IsoDate, days: number): IsoDate {
  const t = new Date(utcNoon(date) + days * 86_400_000);
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = parseIsoDate(date);
  const t = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d, lastDay));
}

export const daysBetween = (a: IsoDate, b: IsoDate) => Math.round((utcNoon(b) - utcNoon(a)) / 86_400_000);

/** Minutes after local midnight at an instant, on that instant's local date. */
export function minuteOfDay(ms: number, timeZone: string): number {
  const p = wallClock(ms, timeZone);
  return p.hour * 60 + p.minute + p.second / 60;
}

/**
 * A fixed-offset zone for somewhere with no nearby place to borrow a time
 * zone from (mid-ocean): nautical time, an hour per 15° of longitude.
 * Etc/GMT signs are backwards: Etc/GMT-5 is five hours ahead.
 */
export function nauticalTimeZone(lng: number): string {
  const hours = Math.round(lng / 15);
  if (hours === 0) return 'Etc/GMT';
  return `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}
