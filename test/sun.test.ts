import { describe, expect, it } from 'vitest';
import { daylightRows, intervals } from '../src/lib/daylight.ts';
import { normalise, normaliseLoose } from '../src/lib/normalise.ts';
import { seasons } from '../src/lib/sun.ts';
import { addMonths, nauticalTimeZone, offsetMinutes } from '../src/lib/tz.ts';

const london = { lat: 51.50853, lng: -0.12574, timeZone: 'Europe/London' };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const riseSet = (row: ReturnType<typeof daylightRows>[number]) => {
  const c = row.crossings.day;
  if (typeof c === 'string') return c;
  return `${hhmm(c.riseMin)}-${hhmm(c.setMin)}`;
};

describe('normalise', () => {
  it('matches the Perl', () => {
    expect(normalise('Saint-Étienne')).toBe('saintetienne');
    expect(normalise('München')).toBe('munchen');
    expect(normalise('Łódź')).toBe('lodz');
    expect(normalise('Straße')).toBe('strasse');
    expect(normaliseLoose('Manchster')).toBe(normaliseLoose('Manchester'));
  });
});

describe('daylight', () => {
  // The Perl app (DateTime::Event::Sunrise, upper limb) said 06:46-16:41 and 04:42-21:21
  it('agrees with the old app to within a couple of minutes', () => {
    const [mid, solstice] = daylightRows(london, '2026-10-28', '2026-10-28').concat(
      daylightRows(london, '2026-06-21', '2026-06-21'),
    );
    expect(riseSet(mid)).toMatch(/^06:4[5-8]-16:4[0-3]$/);
    expect(riseSet(solstice)).toMatch(/^04:4[1-4]-21:(19|2[0-3])$/);
  });

  it('notices the clocks changing', () => {
    const rows = daylightRows(london, '2026-10-24', '2026-10-26');
    expect(rows.map((r) => r.clockChange)).toEqual([0, -60, 0]);
    expect(rows[2].offset).toBe(0);
  });

  it('handles polar day and night', () => {
    const svalbard = { lat: 78.22, lng: 15.65, timeZone: 'Arctic/Longyearbyen' };
    expect(riseSet(daylightRows(svalbard, '2026-06-21', '2026-06-21')[0])).toBe('up');
    expect(riseSet(daylightRows(svalbard, '2026-12-21', '2026-12-21')[0])).toBe('down');
    expect(intervals('up')).toEqual([[0, 1440]]);
  });

  it('wraps late twilight across midnight', () => {
    expect(intervals({ rise: 0, set: 0, riseMin: 100, setMin: 1500 })).toEqual([[100, 1440], [0, 60]]);
  });

  it('marks solstices and equinoxes', () => {
    const events = seasons(2026).map((s) => new Date(s.at).toISOString().slice(0, 16));
    // Published: 20 Mar 14:46, 21 Jun 08:24, 23 Sep 00:05, 21 Dec 20:50 UTC
    expect(events.map((e) => e.slice(0, 10))).toEqual(['2026-03-20', '2026-06-21', '2026-09-23', '2026-12-21']);
    const rows = daylightRows(london, '2026-06-20', '2026-06-22');
    expect(rows[1].season).toBe('June solstice');
  });
});

describe('tz', () => {
  it('does offsets and nautical time', () => {
    expect(offsetMinutes(Date.UTC(2026, 6, 1), 'Europe/London')).toBe(60);
    expect(nauticalTimeZone(-75)).toBe('Etc/GMT+5');
    expect(offsetMinutes(Date.UTC(2026, 0, 1), nauticalTimeZone(80))).toBe(300);
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
  });
});

describe('urls', async () => {
  const { placePath, slug } = await import('../src/lib/place.ts');
  const { rangeFromParams, rangeToParams, resolveRange } = await import('../src/lib/ranges.ts');

  it('makes stable place paths', () => {
    expect(slug('Saint-Étienne-du-Rouvray')).toBe('saint-etienne-du-rouvray');
    expect(placePath({ id: 2643743, name: 'London', label: '', lat: 0, lng: 0, timeZone: 'UTC' })).toBe('/place/2643743/london');
    expect(placePath({ name: 'x', label: '', lat: 51.48, lng: -0.0012345, timeZone: 'UTC' })).toBe('/at/51.4800,-0.0012');
  });

  it('round-trips ranges', () => {
    expect(resolveRange(rangeFromParams(new URLSearchParams('range=30d')), '2026-03-15')).toEqual(['2026-02-13', '2026-04-14']);
    expect(resolveRange({ preset: 'next12m' }, '2026-03-15')).toEqual(['2026-03-15', '2027-03-14']);
    expect(rangeFromParams(new URLSearchParams('from=2026-01-01&to=2025-01-01'))).toEqual({ preset: '6m' });
    expect(rangeToParams({ from: '2026-01-01', to: '2026-02-01' })).toBe('?from=2026-01-01&to=2026-02-01');
    expect(rangeToParams({ preset: '6m' })).toBe('');
  });
});
