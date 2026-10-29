import { describe, expect, it } from 'vitest';
import { solarDay } from '../src/lib/sun.ts';
import { solarTheme } from '../src/lib/theme.ts';

const london = { lat: 51.50853, lng: -0.12574 };
const noon = Date.UTC(2026, 9, 28, 12);
const sun = solarDay(noon, london.lat, london.lng);
const crossing = (level: keyof typeof sun.crossings) => {
  const event = sun.crossings[level];
  if (typeof event === 'string') throw new Error(`Missing ${level}`);
  return event;
};

const page = (at: number) => solarTheme(london, at).variables['--page'];

describe('solar theme', () => {
  it('switches polarity at the calculated sunrise and sunset', () => {
    const { rise, set } = crossing('day');
    expect(solarTheme(london, rise - 1).mode).toBe('dark');
    expect(solarTheme(london, rise).mode).toBe('light');
    expect(solarTheme(london, set - 1).mode).toBe('light');
    expect(solarTheme(london, set).mode).toBe('dark');
  });

  it('moves from blue through orange and red into deep twilight blues', () => {
    expect(page(sun.noon)).toBe('rgb(126, 201, 255)');
    expect(page(crossing('day').rise)).toBe('rgb(255, 184, 123)');
    expect(page(crossing('day').set)).toBe('rgb(115, 44, 59)');
    expect(page(crossing('nautical').set)).toBe('rgb(17, 33, 66)');
    expect(page(crossing('astronomical').set)).toBe('rgb(5, 14, 33)');
    expect(page(crossing('civil').set + 60_000)).not.toBe(page(crossing('civil').set));
  });

  it('reaches midnight blue halfway through the night, including across a clock change', () => {
    for (const date of [24, 28]) {
      const evening = solarDay(Date.UTC(2026, 9, date, 12), london.lat, london.lng).crossings.day;
      const morning = solarDay(Date.UTC(2026, 9, date + 1, 12), london.lat, london.lng).crossings.day;
      if (typeof evening === 'string' || typeof morning === 'string') throw new Error('Missing night');
      expect(solarTheme(london, (evening.set + morning.rise) / 2).variables['--page']).toBe('rgb(2, 8, 24)');
    }
  });

  it('follows the selected coordinates even across the date line', () => {
    const at = Date.UTC(2026, 2, 20, 0);
    expect(solarTheme({ lat: 0, lng: 180 }, at).mode).toBe('light');
    expect(solarTheme({ lat: 0, lng: 0 }, at).mode).toBe('dark');
    expect(solarTheme({ lat: 0, lng: -180 }, at)).toEqual(solarTheme({ lat: 0, lng: 180 }, at));
  });

  it('handles polar day, polar night and nights without astronomical twilight', () => {
    const pole = { lat: 78.22, lng: 15.65 };
    for (let hour = 0; hour < 24; hour++) {
      const summer = solarTheme(pole, Date.UTC(2026, 5, 21, hour));
      const winter = solarTheme(pole, Date.UTC(2026, 11, 21, hour));
      expect(summer.mode).toBe('light');
      expect(winter.mode).toBe('dark');
      expect(winter.variables['--page']).not.toBe('rgb(0, 0, 0)');
      expect(JSON.stringify([summer, winter])).not.toMatch(/NaN|undefined/);
    }
    const whiteNight = solarTheme(london, Date.UTC(2026, 5, 21, 23));
    expect(whiteNight.mode).toBe('dark');
    expect(whiteNight.variables['--page']).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});
