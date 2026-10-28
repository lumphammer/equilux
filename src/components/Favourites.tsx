import { useEffect, useRef, useState } from 'preact/hooks';
import {
  FAVOURITES_KEY,
  FAVOURITE_NAME_LIMIT,
  type Favourite,
  favouriteKey,
  parseFavourites,
} from '../lib/favourites.ts';
import { type Place, placePath } from '../lib/place.ts';

interface Props {
  place: Place;
  onPick: (place: Place) => void;
}

export function Favourites({ place, onPick }: Props) {
  const [items, setItems] = useState<Favourite[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const section = useRef<HTMLElement>(null);
  const currentKey = favouriteKey(place);
  const saved = items.some((item) => favouriteKey(item.place) === currentKey);

  useEffect(() => {
    try {
      setItems(parseFavourites(localStorage.getItem(FAVOURITES_KEY)));
    } catch {
      setError('Favourites need browser storage, which is unavailable here.');
    }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === FAVOURITES_KEY || event.key === null) {
        setItems(parseFavourites(event.newValue));
        setEditing(null);
      }
    };
    addEventListener('storage', sync);
    return () => removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  const save = (updated: Favourite[]) => {
    try {
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify(updated));
      setItems(updated);
      setError('');
      return true;
    } catch {
      setError('Couldn’t save your favourites. Check that browser storage is available and has space.');
      return false;
    }
  };

  const finishEditing = (key: string) => {
    setEditing(null);
    // Restore keyboard focus to the renamed row's action after the form disappears.
    requestAnimationFrame(() => {
      const row = Array.from(section.current?.querySelectorAll<HTMLElement>('[data-favourite]') ?? []).find(
        (element) => element.dataset.favourite === key,
      );
      row?.querySelector<HTMLButtonElement>('button')?.focus();
    });
  };

  return (
    <section class="favourites" aria-labelledby="favourites-heading" ref={section}>
      <div class="favourites-heading">
        <h2 id="favourites-heading">Favourites</h2>
        <button
          type="button"
          class="chip"
          disabled={!ready || saved}
          onClick={() => save([...items, { name: place.name, place }])}
        >
          <span aria-hidden="true">{saved ? '★' : '☆'}</span>{' '}
          {saved ? 'Saved to favourites' : 'Favourite this location'}
        </button>
      </div>
      {items.length > 0 ? (
        <ul class="favourites-list">
          {items.map((item) => {
            const key = favouriteKey(item.place);
            return (
              <li key={key} data-favourite={key}>
                {editing === key ? (
                  <form
                    class="favourite-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const trimmed = name.trim();
                      if (!trimmed) {
                        input.current?.setCustomValidity('Enter a name for this favourite.');
                        input.current?.reportValidity();
                        return;
                      }
                      if (
                        save(
                          items.map((other) =>
                            favouriteKey(other.place) === key ? { ...other, name: trimmed } : other,
                          ),
                        )
                      ) {
                        finishEditing(key);
                      }
                    }}
                  >
                    <label class="visually-hidden" htmlFor="favourite-name">
                      Favourite name
                    </label>
                    <input
                      id="favourite-name"
                      ref={input}
                      value={name}
                      required
                      maxLength={FAVOURITE_NAME_LIMIT}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          finishEditing(key);
                        }
                      }}
                      onInput={(event) => {
                        event.currentTarget.setCustomValidity('');
                        setName(event.currentTarget.value);
                      }}
                    />
                    <button type="submit" class="chip">
                      Save
                    </button>
                    <button type="button" class="chip" onClick={() => finishEditing(key)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <a
                      href={placePath(item.place)}
                      title={item.place.label}
                      aria-current={key === currentKey ? 'location' : undefined}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        onPick(item.place);
                      }}
                    >
                      {item.name}
                    </a>
                    <div class="favourite-actions">
                      <button
                        type="button"
                        class="chip"
                        aria-label={`Rename ${item.name}`}
                        onClick={() => {
                          setName(item.name);
                          setEditing(key);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        class="chip"
                        aria-label={`Delete ${item.name} from favourites`}
                        onClick={() => {
                          if (save(items.filter((other) => favouriteKey(other.place) !== key))) {
                            requestAnimationFrame(() => {
                              section.current
                                ?.querySelector<HTMLElement>(
                                  '.favourites-list a, .favourites-heading button:not(:disabled)',
                                )
                                ?.focus();
                            });
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p class="favourites-note">Save places here to find them again. Favourites are stored in this browser.</p>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
