#!/bin/sh
# Downloads GeoNames' populated places (cities500: every place with at least
# 500 people) and region names into data/, for scripts/build-places.ts.
#
# Needs curl and unzip.
set -e

cd "$(dirname "$0")/.."
mkdir -p data
cd data

URL=https://download.geonames.org/export/dump

echo "Fetching GeoNames cities500 (about 15MB)"
curl -fL --retry 3 -o cities500.zip "$URL/cities500.zip"
unzip -o -q cities500.zip cities500.txt
rm cities500.zip
curl -fL --retry 3 -o admin1CodesASCII.txt "$URL/admin1CodesASCII.txt"

ls -l cities500.txt admin1CodesASCII.txt
