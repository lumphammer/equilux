import { useEffect, useMemo, useState } from 'preact/hooks';
import { daylightRows } from '../lib/daylight.ts';
import { formatTime } from '../lib/format.ts';
import type { Place } from '../lib/place.ts';
import { PRESETS, resolveRange } from '../lib/ranges.ts';
import { applySolarTheme, solarTheme } from '../lib/theme.ts';
import { addDays, daysBetween, localDate } from '../lib/tz.ts';
import { DayLengthChart } from './DayLengthChart.tsx';
import { DaylightChart } from './DaylightChart.tsx';
import { MapView } from './MapView.tsx';
import { Today } from './Today.tsx';

// Somewhere unremarkable on the prime meridian, so the clock and the sun
// roughly agree, on the March equinox.
export const PALETTE_PLACE: Place = {
  name: 'Equinoxville',
  label: 'Equinoxville, Palette test',
  lat: 45,
  lng: 0,
  timeZone: 'UTC',
};
export const PALETTE_DAY = Date.UTC(2026, 2, 20);
export const PALETTE_START_MINUTE = 6 * 60;

const MINUTE = 60_000;
const PLAY_MINUTES_PER_SECOND = 60;
const noop = () => {};

interface Props {
  locale: string;
}

/** The main page's colouring, driven by a scrubber instead of the clock. */
export default function PaletteTest({ locale }: Props) {
  const place = PALETTE_PLACE;
  const [minute, setMinute] = useState(PALETTE_START_MINUTE);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const now = PALETTE_DAY + minute * MINUTE;
  const theme = useMemo(() => solarTheme(place, now), [place, now]);

  useEffect(() => applySolarTheme(theme), [theme]);

  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const step = (time: number) => {
      const elapsed = time - previous;
      previous = time;
      setMinute((m) => (m + (elapsed / 1000) * PLAY_MINUTES_PER_SECOND) % 1440);
      frame = requestAnimationFrame(step);
    };
    let frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  // The page colour across the whole day, to see the palette at a glance
  const gradient = useMemo(() => {
    const stops = Array.from({ length: 97 }, (_, i) => {
      const page = solarTheme(place, PALETTE_DAY + i * 15 * MINUTE).variables['--page'];
      return `${page} ${((i / 96) * 100).toFixed(2)}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [place]);

  const today = localDate(now, place.timeZone);
  const [from, to] = resolveRange({ preset: '6m' }, today);
  const rows = useMemo(() => daylightRows(place, from, to), [place, from, to]);
  const around = useMemo(() => daylightRows(place, addDays(today, -1), addDays(today, 1)), [place, today]);
  const todayIndex = daysBetween(from, today);

  return (
    <div class="app">
      <section class="palette-scrubber" aria-label="Simulated time">
        <div class="palette-scrubber-row">
          <button type="button" class="chip" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <label class="palette-time">
            <span class="visually-hidden">Time of day</span>
            <input
              type="range"
              min={0}
              max={1439}
              step={1}
              value={Math.floor(minute)}
              onInput={(e) => {
                setPlaying(false);
                setMinute(Number((e.target as HTMLInputElement).value));
              }}
            />
            <span class="palette-gradient" style={{ background: gradient }} aria-hidden="true" />
          </label>
          <output class="palette-clock">
            {formatTime(now, place.timeZone, locale)} · {theme.mode}
          </output>
        </div>
        <ul class="palette-swatches">
          {Object.entries(theme.variables).map(([name, value]) => (
            <li key={name}>
              <span class="swatch" style={{ background: value }} />
              <code>{name}</code> <span class="muted">{value}</span>
            </li>
          ))}
        </ul>
      </section>

      <div class="finder">
        <div class="finder-controls">
          <form class="search" role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="place-search" class="visually-hidden">
              Find a place
            </label>
            <input id="place-search" type="search" placeholder="Find a place, or “51.48, 0”" autocomplete="off" />
          </form>
          <button type="button" class="button">
            Use my location
          </button>
        </div>
        <nav class="recent" aria-label="Recent places">
          Recent: <a href="#recent">Lisbon</a> <a href="#recent">Reykjavík</a> <a href="#recent">Quito</a>
        </nav>
        <section class="favourites" aria-labelledby="favourites-heading">
          <div class="favourites-heading">
            <h2 id="favourites-heading">Favourites</h2>
            <button type="button" class="chip">
              <span aria-hidden="true">☆</span> Favourite this location
            </button>
          </div>
          <ul class="favourites-list">
            {['Home', 'Grandma’s'].map((name) => (
              <li key={name}>
                <a href="#favourite" aria-current={name === 'Home' ? 'location' : undefined}>
                  {name}
                </a>
                <div class="favourite-actions">
                  <button type="button" class="chip">
                    Rename
                  </button>
                  <button type="button" class="chip">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <p class="error" role="alert">
          Couldn’t look that point up. Are you online?
        </p>
        <MapView place={place} onPick={noop} dark={theme.mode === 'dark'} now={now} />
      </div>

      <header class="place-heading">
        <h1>{place.name}</h1>
        <p class="place-meta">
          Palette test · <a href="#near">12 km from Somewhere Else</a> · UTC · Population 12,345
        </p>
        <p class="guess-note">We guessed this from your internet connection. Search or click the map if it’s wrong.</p>
      </header>
      <Today
        place={place}
        today={today}
        now={now}
        days={around as [(typeof rows)[0], (typeof rows)[0], (typeof rows)[0]]}
        locale={locale}
      />

      <section class="charts" aria-label="Sunlight over time">
        <fieldset class="range-picker">
          <legend class="visually-hidden">Date range</legend>
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button key={key} type="button" class="chip" aria-pressed={key === '6m'}>
              {preset.label}
            </button>
          ))}
          <span class="custom-range">
            <label>
              From <input type="date" value={from} readOnly />
            </label>
            <label>
              to <input type="date" value={to} readOnly />
            </label>
          </span>
        </fieldset>
        <DaylightChart
          rows={rows}
          today={todayIndex}
          hover={hover}
          setHover={setHover}
          timeZone={place.timeZone}
          locale={locale}
        />
        <DayLengthChart rows={rows} today={todayIndex} hover={hover} setHover={setHover} locale={locale} />
      </section>
    </div>
  );
}
