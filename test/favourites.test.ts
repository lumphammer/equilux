import { describe, expect, it } from 'vitest';
import { favouriteKey, parseFavourites } from '../src/lib/favourites.ts';
import { placePath, type Place } from '../src/lib/place.ts';

const london: Place = {
  id: 2643743,
  name: 'London',
  label: 'London, England, United Kingdom',
  lat: 51.50853,
  lng: -0.12574,
  timeZone: 'Europe/London',
};
const point: Place = { name: 'A point', label: 'A point', lat: 51.48, lng: -0.0012345, timeZone: 'Europe/London' };

describe('saved favourites', () => {
  it('round-trips aliases without changing the location or its URL', () => {
    const stored = JSON.stringify([
      { name: 'Home', place: london },
      { name: 'Riverside', place: point },
    ]);
    const favourites = parseFavourites(stored);
    expect(favourites.map((item) => item.name)).toEqual(['Home', 'Riverside']);
    expect(favourites[0].place.name).toBe('London');
    expect(placePath(favourites[0].place)).toBe(placePath(london));
    expect(favourites[1].place).toEqual(point);
  });

  it('keeps identity stable across changed place names and rounded coordinates', () => {
    expect(favouriteKey(london)).toBe(favouriteKey({ ...london, name: 'London city' }));
    expect(favouriteKey(point)).toBe(favouriteKey({ ...point, lng: -0.00123 }));
    expect(
      parseFavourites(
        JSON.stringify([
          { name: 'Home', place: london },
          { name: 'Duplicate', place: { ...london, name: 'London city' } },
        ]),
      ),
    ).toEqual([{ name: 'Home', place: london }]);
  });

  it('handles missing, malformed and invalid stored data', () => {
    for (const value of [null, '{', '{}', 'null', '[null, 1, "London"]']) expect(parseFavourites(value)).toEqual([]);
    const parsed = parseFavourites(
      JSON.stringify([
        { name: '  Home  ', place: london },
        { name: '   ', place: point },
        { name: 'Invalid zone', place: { ...point, timeZone: 'Nowhere' } },
        { name: 'Invalid coordinates', place: { ...point, lat: 100 } },
        { name: 'Missing place', place: {} },
      ]),
    );
    expect(parsed).toEqual([{ name: 'Home', place: london }]);
  });
});
