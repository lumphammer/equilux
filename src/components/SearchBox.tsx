import { useEffect, useRef, useState } from 'preact/hooks';
import type { Place } from '../lib/place.ts';

interface Props {
  onPlace: (place: Place) => void;
  onPoint: (lat: number, lng: number) => void;
}

const COORDINATES = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/** Place search with suggestions as you type. Also takes "lat, lng". */
export function SearchBox({ onPlace, onPoint }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState('');
  const latest = useRef('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || COORDINATES.test(q)) {
      setResults([]);
      setSearched('');
      return;
    }
    latest.current = q;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const { results } = (await response.json()) as { results: Place[] };
        if (latest.current !== q) return;
        setResults(results);
        setSearched(q);
        setActive(0);
        setOpen(true);
      } catch {
        // Offline or the like; the map still works
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = (place: Place) => {
    setOpen(false);
    setQuery('');
    onPlace(place);
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const m = COORDINATES.exec(query);
    if (m) {
      const [lat, lng] = [Number(m[1]), Number(m[2])];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        setQuery('');
        onPoint(lat, lng);
      }
      return;
    }
    if (results[active]) choose(results[active]);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (results.length ? (a + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0));
    } else if (e.key === 'Escape') setOpen(false);
  };

  const showList = open && query.trim().length >= 2 && searched === query.trim();

  return (
    <form class="search" role="search" onSubmit={submit}>
      <label for="place-search" class="visually-hidden">Find a place</label>
      <input
        id="place-search"
        type="search"
        placeholder="Find a place, or “51.48, 0”"
        autocomplete="off"
        spellcheck={false}
        role="combobox"
        list={undefined}
        aria-expanded={showList}
        aria-controls="place-results"
        aria-activedescendant={showList && results[active] ? `place-result-${active}` : undefined}
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {showList && (
        <ul id="place-results" role="listbox" class="results">
          {results.map((place, i) => (
            <li
              key={place.id}
              id={`place-result-${i}`}
              role="option"
              aria-selected={i === active}
              class={i === active ? 'active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(place)}
              onMouseEnter={() => setActive(i)}
            >
              <span class="result-name">{place.name}</span>
              <span class="result-label">{place.label.slice(place.name.length).replace(/^, /, '')}</span>
              {place.population ? <span class="result-population">{place.population.toLocaleString()}</span> : null}
            </li>
          ))}
          {!results.length && <li class="no-results">Nowhere called that. Try the map?</li>}
        </ul>
      )}
    </form>
  );
}
