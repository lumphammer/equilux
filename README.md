# Equilux

Sunrise, sunset and twilight anywhere in the world, charted over the year.

The equilux is the day when daylight and darkness are exactly equal. It isn't
the equinox: refraction and the width of the sun's disc make daylight on the
equinox a few minutes longer than darkness.

Built with Astro, TypeScript and Preact on Cloudflare Workers, with places in
D1. It grew out of Sunlightr, a Perl app from 2007.

- Pick a place on the map (MapLibre, OpenFreeMap tiles, with the night side of
  the Earth shaded) or search for one; "Paris, Texas" and "51.48, 0" work.
- Today at a glance: sunrise and sunset with compass bearings, day length and
  how it's changing, solar noon, first and last light, golden hour, the next
  solstice or equinox and the next clock change.
- A chart of daylight and the three twilights by date, with presets (±30 days,
  ±3 months, ±6 months, next 12 months, this year) or any range up to three
  years, and a day-length chart beneath it. Hover or use the arrow keys to
  read a day; a table and CSV download have every value.
- Shareable URLs: `/place/<GeoNames ID>/<slug>` and `/at/<lat>,<lng>`, plus
  `?range=` or `?from=&to=`.
- The first visit starts near wherever Cloudflare thinks you are.

## How it works

The sun's position is calculated in the browser (`src/lib/sun.ts`, after
Meeus), so changing the range costs nothing; times are good to a minute or
two. The server only finds places: search, the nearest place to a map click
(whose time zone a point borrows; mid-ocean it falls back to nautical time),
and server-rendered pages for search engines and link previews.

Place names are matched after normalisation (`src/lib/normalise.ts`): accents,
spaces and punctuation are ignored, with a looser fallback for misspellings.

## Running it

Needs Node 24 or later (the data scripts are TypeScript, run directly).

    npm install
    npm run data:fetch     # download GeoNames' cities500 into data/ (needs curl and unzip)
    npm run data:local     # build data/places.sql and load it into local D1
    npm run dev            # http://localhost:4321

Without `data:fetch`, `data:local` loads the small sample in `reference/`.
The full set is about 237,000 places and takes half a minute to load.

    npm test               # sun maths, time zones, normalisation, URLs
    npm run check          # TypeScript
    npm run preview        # production build in workerd, on :8787

## Deploying

    npx wrangler d1 create equilux       # put the database_id in wrangler.jsonc
    npm run data:remote
    npm run deploy

## Credits and licence

Places from [GeoNames](https://www.geonames.org/) (CC BY 4.0), credited in the
footer; map tiles from [OpenFreeMap](https://openfreemap.org/) and
[OpenStreetMap](https://www.openstreetmap.org/copyright), credited on the map.

The code is MIT licensed; see LICENSE. The place data keeps its own CC BY 4.0
licence.
