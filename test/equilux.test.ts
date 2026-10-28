import { describe, expect, it } from 'vitest';
import { daylightRows } from '../src/lib/daylight.ts';
import { addDays } from '../src/lib/tz.ts';

const london = { lat: 51.50853, lng: -0.12574, timeZone: 'Europe/London' };
const dates = (place: typeof london, from = '2026-01-01', to = '2026-12-31') =>
  daylightRows(place, from, to)
    .filter((row) => row.equilux)
    .map((row) => row.date);

describe('local equilux dates', () => {
  it('marks the closest day to each 12-hour crossing in London', () => {
    const found = dates(london);
    expect(found).toEqual(['2026-03-17', '2026-09-25']);
    for (const date of found) {
      const [before, row, after] = daylightRows(london, addDays(date, -1), addDays(date, 1));
      expect(Math.abs(row.dayLength - 720)).toBeLessThan(Math.abs(before.dayLength - 720));
      expect(Math.abs(row.dayLength - 720)).toBeLessThan(Math.abs(after.dayLength - 720));
      expect((before.dayLength - 720) * (after.dayLength - 720)).toBeLessThan(0);
    }
  });

  it('uses the location, reversing the relation to equinoxes in the southern hemisphere', () => {
    expect(dates({ lat: -33.87, lng: 151.21, timeZone: 'Australia/Sydney' })).toEqual(['2026-03-24', '2026-09-19']);
  });

  it('keeps markers when they fall at either end of a range or on the only day', () => {
    for (const date of dates(london)) {
      expect(dates(london, date, date)).toEqual([date]);
      expect(dates(london, date, addDays(date, 4))).toEqual([date]);
      expect(dates(london, addDays(date, -4), date)).toEqual([date]);
      expect(dates(london, addDays(date, 1), addDays(date, 4))).toEqual([]);
    }
  });

  it('does not invent equiluxes where daylight never crosses 12 hours', () => {
    expect(dates({ lat: 0, lng: 0, timeZone: 'UTC' })).toEqual([]);
    expect(dates({ lat: 90, lng: 0, timeZone: 'UTC' })).toEqual([]);
  });

  it('finds both annual pairs in a range spanning years', () => {
    expect(dates(london, '2025-12-01', '2027-12-31').map((date) => date.slice(0, 4))).toEqual([
      '2026',
      '2026',
      '2027',
      '2027',
    ]);
  });
});
