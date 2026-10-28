Small reference files that live in git:

- `countries.tsv`: ISO 3166 countries, with everyday English names (and XK
  for Kosovo, which GeoNames uses), for labels like "Manchester, England,
  United Kingdom" and for "Paris, Texas" style searches.
- `geonames-sample.txt` and `geonames-admin1-sample.txt`: a few dozen places
  in GeoNames' format, enough to run the app and tests without downloading
  the full set. Run `npm run data:fetch` for that.

GeoNames data is licensed under CC BY 4.0: https://www.geonames.org/
