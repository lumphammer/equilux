/// <reference types="node" />
// Turns GeoNames' cities500 into SQL for D1: data/places.sql.
//
//   node scripts/build-places.ts [--cities=path] [--admin1=path] [--countries=path]
//
// Defaults to the files scripts/fetch-geonames.sh downloads into data/, or
// the samples in reference/ if they're missing.

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { normalise, normaliseLoose } from '../src/lib/normalise.ts';

const root = new URL('../', import.meta.url).pathname;
const fullCities = `${root}data/cities500.txt`;
const full = existsSync(fullCities);

const { values: opts } = parseArgs({
  options: {
    cities: { type: 'string', default: full ? fullCities : `${root}reference/geonames-sample.txt` },
    admin1: {
      type: 'string',
      default: full ? `${root}data/admin1CodesASCII.txt` : `${root}reference/geonames-admin1-sample.txt`,
    },
    countries: { type: 'string', default: `${root}reference/countries.tsv` },
    out: { type: 'string', default: `${root}data/places.sql` },
  },
});

const tsv = (file: string): string[][] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line: string) => line.split('\t'));

const countries = new Map(
  tsv(opts.countries)
    .slice(1)
    .map(([iso2, , , name]) => [iso2, name]),
);
const regions = new Map(tsv(opts.admin1).map(([code, name]) => [code, name]));

const sql = (v: string | number) => (typeof v === 'number' ? String(v) : `'${v.replaceAll("'", "''")}'`);

// D1 limits statements to 100KB, so insert in modest batches
const BATCH = 200;
const out: string[] = ['DELETE FROM place_names;', 'DELETE FROM places;'];
let placeRows: string[] = [];
let nameRows: string[] = [];
const flush = () => {
  if (placeRows.length) out.push(`INSERT INTO places VALUES\n${placeRows.join(',\n')};`);
  if (nameRows.length) out.push(`INSERT INTO place_names VALUES\n${nameRows.join(',\n')};`);
  placeRows = [];
  nameRows = [];
};

let places = 0;
let names = 0;
const lines = createInterface({ input: createReadStream(opts.cities, 'utf8'), crlfDelay: Infinity });
for await (const line of lines) {
  if (!line) continue;
  const f = line.split('\t');
  const [id, name, ascii, alternates, lat, lng] = f;
  const [country, admin1, population, timezone] = [f[8], f[10], Number(f[14]) || 0, f[17]];
  if (!timezone) continue;

  const region = regions.get(`${country}.${admin1}`);
  const countryName = countries.get(country) ?? country;
  const label = [name, region && region !== name ? region : null, countryName].filter(Boolean).join(', ');
  const qualifiers = [region ?? '', countryName, country].map(normalise).join(' ');

  placeRows.push(
    `(${[Number(id), name, label, country, Number(lat), Number(lng), population, timezone, qualifiers].map(sql).join(',')})`,
  );
  places++;

  // Alternative names include other languages ("Londres"), other scripts
  // (which normalise to nothing) and codes (airports and the like)
  const seen = new Set<string>();
  const all: [string, number][] = [
    [name, 0],
    [ascii, 0],
    ...alternates.split(',').map((a: string): [string, number] => [a, 1]),
  ];
  for (const [alias, isAlias] of all) {
    const n = normalise(alias);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    nameRows.push(`(${[n, normaliseLoose(alias), Number(id), isAlias, population].map(sql).join(',')})`);
    names++;
  }
  if (placeRows.length >= BATCH) flush();
}
flush();

mkdirSync(`${root}data`, { recursive: true });
writeFileSync(opts.out, out.join('\n') + '\n');
console.log(`${places} places, ${names} names from ${opts.cities} -> ${opts.out}`);
