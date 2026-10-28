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
  dark?: boolean;
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
export function MapView({ place, onPick, dark = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ map: MapLibreMap; marker: Marker } | null>(null);
  const styleRef = useRef(dark);
  const darkRef = useRef(dark);
  useEffect(() => {
    darkRef.current = dark;
  }, [dark]);
  // Where the map starts; later places move it rather than recreate it
  const [start] = useState(() =>
    place
      ? { center: [place.lng, place.lat] as [number, number], zoom: place.id ? 6 : 5 }
      : { center: [0, 30] as [number, number], zoom: 1 },
  );

  useEffect(() => {
    let cancelled = false;
    let created: MapLibreMap | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const maplibre = await import('maplibre-gl');
      maplibre.setWorkerUrl(workerUrl);
      if (cancelled || !container.current) return;
      const isDark = darkRef.current;
      styleRef.current = isDark;
      const map = new maplibre.Map({
        container: container.current,
        style: isDark ? STYLES.dark : STYLES.light,
        ...start,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      map.on('style.load', () => {
        map.addSource('night', { type: 'geojson', data: nightPolygon(Date.now()) });
        map.addLayer({
          id: 'night',
          type: 'fill',
          source: 'night',
          paint: { 'fill-color': '#0d366b', 'fill-opacity': darkRef.current ? 0.35 : 0.18 },
        });
        clearInterval(timer);
        timer = setInterval(
          () => (map.getSource('night') as GeoJSONSource | undefined)?.setData(nightPolygon(Date.now())),
          60_000,
        );
      });
      created = map;
      setView({ map, marker: new maplibre.Marker({ color: '#eb6834' }) });
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      created?.remove();
    };
  }, [start]);

  useEffect(() => {
    if (view && styleRef.current !== dark) {
      styleRef.current = dark;
      view.map.setStyle(dark ? STYLES.dark : STYLES.light);
    }
  }, [view, dark]);

  useEffect(() => {
    if (!view) return;
    const onClick = (e: MapMouseEvent) => onPick(e.lngLat.lat, e.lngLat.wrap().lng);
    view.map.on('click', onClick);
    return () => {
      view.map.off('click', onClick);
    };
  }, [view, onPick]);

  useEffect(() => {
    if (!view) return;
    if (!place) {
      view.marker.remove();
      return;
    }
    view.marker.setLngLat([place.lng, place.lat]).addTo(view.map);
    const zoom = Math.max(view.map.getZoom(), place.id ? 6 : 4);
    view.map.easeTo({ center: [place.lng, place.lat], zoom, duration: 800 });
  }, [view, place]);

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
