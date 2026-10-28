import { ALTITUDES, solarDay } from './sun.ts';

const DAY = 86_400_000;
type RGB = readonly [number, number, number];

const BLUE: RGB = [126, 201, 255];
const ORANGE: RGB = [255, 184, 123];
const RED: RGB = [115, 44, 59];
const CIVIL: RGB = [57, 49, 87];
const NAUTICAL: RGB = [17, 33, 66];
const ASTRONOMICAL: RGB = [5, 14, 33];
const BLACK: RGB = [0, 0, 0];

function mix(a: RGB, b: RGB, amount: number): RGB {
  const t = Math.max(0, Math.min(1, amount));
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return [channel(0), channel(1), channel(2)];
}

function sky(altitude: number, dark: boolean): RGB {
  const stops: [number, RGB][] = [
    [-30, BLACK],
    [ALTITUDES.astronomical, ASTRONOMICAL],
    [ALTITUDES.nautical, NAUTICAL],
    [ALTITUDES.civil, CIVIL],
    [ALTITUDES.day, dark ? RED : ORANGE],
    [ALTITUDES.golden, BLUE],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (altitude <= stops[i][0]) {
      const [lo, a] = stops[i - 1];
      const [hi, b] = stops[i];
      return mix(a, b, (altitude - lo) / (hi - lo));
    }
  }
  return BLUE;
}

const css = (rgb: RGB) => `rgb(${rgb.join(', ')})`;

/** Actual solar events, independent of the viewer's clock, time zone or colour preference. */
export function solarTheme(place: { lat: number; lng: number }, now: number) {
  const days = [-2, -1, 0, 1, 2].map((offset) => solarDay(now + offset * DAY, place.lat, place.lng));
  const nearest = days.reduce((a, b) => (Math.abs(a.noon - now) < Math.abs(b.noon - now) ? a : b));
  const daylight = nearest.crossings.day;
  const dark = daylight === 'down' || (typeof daylight === 'object' && (now < daylight.rise || now >= daylight.set));
  const anchors: { at: number; colour: RGB }[] = [];

  for (const day of days) {
    anchors.push({ at: day.noon, colour: sky(90 - Math.abs(place.lat - day.declination), dark) });
    for (const [level, altitude] of Object.entries(ALTITUDES)) {
      const crossing = day.crossings[level as keyof typeof ALTITUDES];
      if (typeof crossing === 'object') {
        const colour = sky(altitude, dark);
        anchors.push({ at: crossing.rise, colour }, { at: crossing.set, colour });
      }
    }
  }

  for (let i = 0; i < days.length - 1; i++) {
    const sunset = days[i].crossings.day;
    const sunrise = days[i + 1].crossings.day;
    // A real night reaches black halfway from sunset to the next sunrise.
    // During polar day/night, use the sun's lowest altitude instead.
    const at =
      typeof sunset === 'object' && typeof sunrise === 'object'
        ? (sunset.set + sunrise.rise) / 2
        : (days[i].noon + days[i + 1].noon) / 2;
    const colour =
      typeof sunset === 'object' && typeof sunrise === 'object'
        ? BLACK
        : sky(Math.abs(place.lat + (days[i].declination + days[i + 1].declination) / 2) - 90, dark);
    anchors.push({ at, colour });
  }

  anchors.sort((a, b) => a.at - b.at);
  const right = anchors.findIndex((anchor) => anchor.at > now);
  const a = anchors[right - 1];
  const b = anchors[right];
  const page = mix(a.colour, b.colour, (now - a.at) / (b.at - a.at));
  const ink: RGB = dark ? [240, 244, 255] : [10, 30, 53];
  const surface = mix(page, dark ? BLACK : [255, 255, 255], dark ? 0.28 : 0.76);
  return {
    mode: dark ? ('dark' as const) : ('light' as const),
    variables: {
      '--page': css(page),
      '--surface': css(surface),
      '--ink': css(ink),
      '--ink-2': css(mix(ink, surface, 0.16)),
      '--muted': css(mix(ink, surface, 0.27)),
      '--hairline': css(mix(surface, ink, 0.16)),
      '--axis': css(mix(surface, ink, 0.38)),
      '--border': css(mix(surface, ink, 0.2)),
    },
  };
}

export function applySolarTheme(theme: ReturnType<typeof solarTheme>, root = document.documentElement) {
  root.dataset.theme = theme.mode;
  for (const [name, value] of Object.entries(theme.variables)) root.style.setProperty(name, value);
}
