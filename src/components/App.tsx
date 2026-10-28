import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { daylightRows } from '../lib/daylight.ts';
import { formatTimeZoneName } from '../lib/format.ts';
import { formatCoordinates, type Place, placePath, slug } from '../lib/place.ts';
import { MAX_DAYS, PRESETS, type PresetKey, type Range, rangeFromParams, rangeToParams, resolveRange } from '../lib/ranges.ts';
import { addDays, daysBetween, type IsoDate, localDate } from '../lib/tz.ts';
import { DayLengthChart } from './DayLengthChart.tsx';
import { DaylightChart } from './DaylightChart.tsx';
import { DayTable } from './DayTable.tsx';
import { MapView } from './MapView.tsx';
import { SearchBox } from './SearchBox.tsx';
import { Today } from './Today.tsx';

interface Props {
  initial: Place;
  /** How we came by the initial place, if the visitor didn't choose it */
  guessed?: boolean;
  /** From the URL, so the server and browser render the same range */
  initialRange: Range;
  locale: string;
}

const RECENT_KEY = 'equilux:recent';
type HistoryState = { place: Place };

export default function App({ initial, guessed, initialRange, locale }: Props) {
  const [place, setPlace] = useState(initial);
  const [isGuess, setIsGuess] = useState(!!guessed);
  const [range, setRange] = useState<Range>(initialRange);
  const [hover, setHover] = useState<number | null>(null);
  const [recent, setRecent] = useState<Place[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const today = localDate(Date.now(), place.timeZone);
  const [from, to] = resolveRange(range, today);
  const rows = useMemo(() => daylightRows(place, from, to), [place, from, to]);
  const around = useMemo(() => daylightRows(place, addDays(today, -1), addDays(today, 1)), [place, today]);
  const todayIndex = today >= from && today <= to ? daysBetween(from, today) : -1;

  // Keep the URL shareable
  const url = (p: Place, r: Range) => placePath(p) + rangeToParams(r);
  useEffect(() => {
    if (!isGuess) history.replaceState({ place } satisfies HistoryState, '', url(place, range));
  }, [range]);

  useEffect(() => {
    history.replaceState({ place } satisfies HistoryState, '');
    const onPop = (e: PopStateEvent) => {
      const state = e.state as HistoryState | null;
      if (state?.place) {
        setPlace(state.place);
        setRange(rangeFromParams(new URLSearchParams(location.search)));
      }
    };
    addEventListener('popstate', onPop);
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'));
    } catch {
      // Ignore a corrupt or blocked localStorage
    }
    return () => removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = `Sunrise and sunset in ${place.name} · Equilux`;
  }, [place]);

  const go = useCallback(
    (next: Place) => {
      setPlace(next);
      setIsGuess(false);
      setHover(null);
      setError('');
      history.pushState({ place: next } satisfies HistoryState, '', url(next, range));
      setRecent((list) => {
        const key = placePath(next);
        const updated = [next, ...list.filter((p) => placePath(p) !== key)].slice(0, 6);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
        } catch {
          // Private browsing, perhaps
        }
        return updated;
      });
    },
    [range],
  );

  const goToPoint = useCallback(
    async (lat: number, lng: number) => {
      try {
        const response = await fetch(`/api/point?at=${lat.toFixed(4)},${lng.toFixed(4)}`);
        if (!response.ok) throw new Error(String(response.status));
        go(((await response.json()) as { place: Place }).place);
      } catch {
        setError('Couldn’t look that point up. Are you online?');
      }
    },
    [go],
  );

  const locate = () => {
    if (!navigator.geolocation) return setError('Your browser can’t tell us where you are.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        goToPoint(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setError('Couldn’t find your location. Try searching instead.');
      },
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  return (
    <div class="app">
      <div class="finder">
        <div class="finder-controls">
          <SearchBox onPlace={go} onPoint={goToPoint} />
          <button type="button" class="button" onClick={locate} disabled={locating}>
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        </div>
        {recent.length > 0 && (
          <nav class="recent" aria-label="Recent places">
            Recent:{' '}
            {recent.map((p) => (
              <a key={placePath(p)} href={placePath(p)} onClick={(e) => { e.preventDefault(); go(p); }}>{p.name}</a>
            ))}
          </nav>
        )}
        {error && <p class="error" role="alert">{error}</p>}
        <MapView place={place} onPick={goToPoint} />
      </div>

      <PlaceHeading place={place} guessed={isGuess} locale={locale} onNear={go} />
      <Today place={place} today={today} days={around as [typeof rows[0], typeof rows[0], typeof rows[0]]} locale={locale} />

      <section class="charts" aria-label="Sunlight over time">
        <RangePicker range={range} setRange={setRange} from={from} to={to} />
        <DaylightChart rows={rows} today={todayIndex} hover={hover} setHover={setHover} timeZone={place.timeZone} locale={locale} />
        <DayLengthChart rows={rows} today={todayIndex} hover={hover} setHover={setHover} locale={locale} />
        <DayTable rows={rows} today={todayIndex} timeZone={place.timeZone} locale={locale}
          fileName={`equilux-${slug(place.name) || 'place'}-${from}-to-${to}`} />
      </section>
    </div>
  );
}

function PlaceHeading({ place, guessed, locale, onNear }: { place: Place; guessed: boolean; locale: string; onNear: (p: Place) => void }) {
  const zone = formatTimeZoneName(Date.now(), place.timeZone, locale);
  const nautical = place.timeZone.startsWith('Etc/');
  return (
    <header class="place-heading">
      <h1>{place.id ? place.name : place.near && place.near.km < 1 ? place.name : 'A point on the map'}</h1>
      <p class="place-meta">
        {place.id ? place.label.slice(place.name.length).replace(/^, /, '') || place.label : formatCoordinates(place.lat, place.lng)}
        {place.near && place.near.km >= 1 && (
          <>
            {' · '}
            {Math.round(place.near.km)} km from{' '}
            <a href={`/place/${place.near.id}/${slug(place.near.label.split(',')[0])}`}
              onClick={(e) => {
                e.preventDefault();
                fetch(`/api/place/${place.near!.id}`)
                  .then((r) => r.json() as Promise<{ place: Place }>)
                  .then((d) => onNear(d.place));
              }}>
              {place.near.label}
            </a>
          </>
        )}
        {' · '}
        <span title={place.timeZone}>{nautical ? `Nautical time, ${zone}` : `${place.timeZone.replaceAll('_', ' ')} (${zone})`}</span>
        {place.population ? ` · Population ${place.population.toLocaleString(locale)}` : ''}
      </p>
      {guessed && <p class="guess-note">We guessed this from your internet connection. Search or click the map if it’s wrong.</p>}
    </header>
  );
}

function RangePicker({ range, setRange, from, to }: { range: Range; setRange: (r: Range) => void; from: IsoDate; to: IsoDate }) {
  const custom = !('preset' in range);
  const setDates = (f: IsoDate, t: IsoDate) => {
    if (!f || !t) return;
    if (f > t) [f, t] = [t, f];
    if (daysBetween(f, t) > MAX_DAYS) t = addDays(f, MAX_DAYS);
    setRange({ from: f, to: t });
  };
  return (
    <div class="range-picker" role="group" aria-label="Date range">
      {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
        <button
          key={key}
          type="button"
          class="chip"
          aria-pressed={'preset' in range && range.preset === key}
          onClick={() => setRange({ preset: key })}
        >
          {PRESETS[key].label}
        </button>
      ))}
      <span class={`custom-range ${custom ? 'is-active' : ''}`}>
        <label>From <input type="date" value={from} onChange={(e) => setDates((e.target as HTMLInputElement).value, to)} /></label>
        <label>to <input type="date" value={to} onChange={(e) => setDates(from, (e.target as HTMLInputElement).value)} /></label>
      </span>
    </div>
  );
}
