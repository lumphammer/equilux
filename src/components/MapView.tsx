import { useEffect, useRef, useState } from 'preact/hooks';
// Static, so the page links it: importing it dynamically alongside the
// library leaves the client bundle preloading a CSS file that's never built
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre looks for its worker beside its own script, which bundling
// moves; have the build emit the worker and say where it went
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Feature, Polygon } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, Marker } from 'maplibre-gl';
import type { Place } from '../lib/place.ts';
import { subsolarPoint } from '../lib/sun.ts';

interface Props {
  place: Place | null;
  onPick: (lat: number, lng: number) => void;
}

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

/**
 * The map: click anywhere to see sunlight there. Shades where it's night
 * right now. MapLibre is big, so it loads after the rest of the page.
 */
export function MapView({ place, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const maplibre = await import('maplibre-gl');
      maplibre.setWorkerUrl(workerUrl);
      if (cancelled || !container.current) return;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const m = new maplibre.Map({
        container: container.current,
        style: dark ? STYLES.dark : STYLES.light,
        center: place ? [place.lng, place.lat] : [0, 30],
        zoom: place ? (place.id ? 6 : 5) : 1,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      m.on('click', (e: MapMouseEvent) => pick.current(e.lngLat.lat, e.lngLat.wrap().lng));
      m.on('load', () => {
        m.addSource('night', { type: 'geojson', data: nightPolygon(Date.now()) });
        m.addLayer({
          id: 'night',
          type: 'fill',
          source: 'night',
          paint: { 'fill-color': '#0d366b', 'fill-opacity': dark ? 0.35 : 0.18 },
        });
        timer = setInterval(() => (m.getSource('night') as GeoJSONSource).setData(nightPolygon(Date.now())), 60_000);
      });
      marker.current = new maplibre.Marker({ color: '#eb6834' });
      map.current = m;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current || !marker.current) return;
    if (!place) {
      marker.current.remove();
      return;
    }
    marker.current.setLngLat([place.lng, place.lat]).addTo(map.current);
    const zoom = Math.max(map.current.getZoom(), place.id ? 6 : 4);
    map.current.easeTo({ center: [place.lng, place.lat], zoom, duration: 800 });
  }, [ready, place?.lat, place?.lng]);

  return (
    <div class="map-wrap">
      <div ref={container} class="map" role="application" aria-label="Map: click to choose a place" />
      <p class="map-hint">Click the map to see sunlight anywhere. The shading shows where it’s night now.</p>
    </div>
  );
}

/** The night side of the Earth as a GeoJSON polygon, from the terminator. */
function nightPolygon(ms: number): Feature<Polygon> {
  const sun = subsolarPoint(ms);
  const r = Math.PI / 180;
  // Avoid dividing by zero at the equinoxes
  const tanDec = Math.tan((Math.abs(sun.lat) < 0.01 ? 0.01 : sun.lat) * r);
  const ring: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const lat = Math.atan(-Math.cos((lng - sun.lng) * r) / tanDec) / r;
    ring.push([lng, lat]);
  }
  // The pole that's in darkness closes the polygon
  const pole = sun.lat > 0 ? -85 : 85;
  ring.push([180, pole], [-180, pole], ring[0]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}
