import { describe, expect, it } from 'vitest';
import { solarDay, surroundingSunEvents } from '../src/lib/sun.ts';

const lat = 51.50853;
const lng = -0.12574;
const noon = Date.UTC(2026, 9, 28, 12);

describe('surrounding sunrise and sunset', () => {
  it('finds sunrise behind and sunset ahead during the day', () => {
    const { previous, next } = surroundingSunEvents(noon, lat, lng);
    expect(previous?.name).toBe('Sunrise');
    expect(next?.name).toBe('Sunset');
    expect(previous!.at).toBeLessThan(noon);
    expect(next!.at).toBeGreaterThan(noon);
  });

  it('uses the previous sunset before dawn and the following sunrise after dusk', () => {
    for (const hour of [2, 23]) {
      const now = Date.UTC(2026, 9, 28, hour);
      const { previous, next } = surroundingSunEvents(now, lat, lng);
      expect(previous?.name).toBe('Sunset');
      expect(next?.name).toBe('Sunrise');
      expect(previous!.at).toBeLessThan(now);
      expect(next!.at).toBeGreaterThan(now);
      expect(next!.at - previous!.at).toBeLessThan(86_400_000);
    }
  });

  it('moves an event into the past at the instant it occurs', () => {
    const crossing = solarDay(noon, lat, lng).crossings.day;
    if (typeof crossing === 'string') throw new Error('No sunrise');
    expect(surroundingSunEvents(crossing.rise - 1, lat, lng).next?.at).toBe(crossing.rise);
    const { previous, next } = surroundingSunEvents(crossing.rise, lat, lng);
    expect(previous).toEqual({ name: 'Sunrise', at: crossing.rise });
    expect(next).toEqual({ name: 'Sunset', at: crossing.set });
  });

  it('finds real events months apart during polar day and night', () => {
    for (const month of [5, 11]) {
      const now = Date.UTC(2026, month, 21, 12);
      const { previous, next } = surroundingSunEvents(now, 78.22, 15.65);
      expect(previous!.at).toBeLessThan(now - 86_400_000);
      expect(next!.at).toBeGreaterThan(now + 86_400_000);
      expect(previous?.name).toBe(month === 5 ? 'Sunrise' : 'Sunset');
      expect(next?.name).toBe(month === 5 ? 'Sunset' : 'Sunrise');
    }
  });
});
