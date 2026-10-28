-- Places from GeoNames' cities500: every populated place with at least
-- 500 people. Filled by scripts/build-places.ts.
CREATE TABLE places (
  geonameid  INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  label      TEXT NOT NULL,  -- "Manchester, England, United Kingdom"
  country    TEXT NOT NULL,  -- ISO 3166 alpha-2
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  population INTEGER NOT NULL,
  timezone   TEXT NOT NULL,
  qualifiers TEXT NOT NULL   -- normalised region, country name and code, for "Paris, Texas"
);
CREATE INDEX places_position ON places (latitude, longitude);

-- Every name a place goes by, normalised for searching. alias is 1 for
-- alternative names, so places actually called that are listed first.
CREATE TABLE place_names (
  name       TEXT NOT NULL,
  loose      TEXT NOT NULL,
  geonameid  INTEGER NOT NULL,
  alias      INTEGER NOT NULL,
  population INTEGER NOT NULL
);
CREATE INDEX place_names_name ON place_names (name, population DESC);
CREATE INDEX place_names_loose ON place_names (loose, population DESC);
