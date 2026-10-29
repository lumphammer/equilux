import type { Map as MapLibreMap } from 'maplibre-gl';
import { subsolarPoint } from './sun.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MERCATOR_LIMIT = 85.051129;

/**
 * A CSS-blended night tint, separate from MapLibre's WebGL canvas. Follows
 * the real time unless given another clock.
 */
export function addNightOverlay(map: MapLibreMap, clock: () => number = Date.now) {
  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.classList.add('map-night-overlay');
  overlay.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  overlay.appendChild(path);
  // Insert before markers so their colour remains unaffected by the tint.
  const canvas = map.getCanvas();
  map.getCanvasContainer().insertBefore(overlay, canvas.nextSibling);

  let ring = nightRing(clock());
  const draw = () => {
    const bounds = map.getBounds();
    const firstWorld = Math.floor((bounds.getWest() + 180) / 360);
    const lastWorld = Math.floor((bounds.getEast() + 180) / 360);
    const paths: string[] = [];
    // Repeat the polygon when panning across the date line or zooming out.
    for (let world = firstWorld; world <= lastWorld; world++) {
      paths.push(
        ring
          .map(([lng, lat], i) => {
            const point = map.project([lng + world * 360, lat]);
            return `${i ? 'L' : 'M'}${point.x},${point.y}`;
          })
          .join(' ') + ' Z',
      );
    }
    path.setAttribute('d', paths.join(' '));
  };
  const update = () => {
    ring = nightRing(clock());
    draw();
  };
  map.on('move', draw);
  map.on('resize', draw);
  document.addEventListener('visibilitychange', update);
  const timer = setInterval(update, 60_000);
  draw();

  return {
    update,
    remove() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      map.off('move', draw);
      map.off('resize', draw);
      overlay.remove();
    },
  };
}

/** The night side of the Earth, closed around the pole facing away from the sun. */
function nightRing(ms: number): [number, number][] {
  const sun = subsolarPoint(ms);
  const r = Math.PI / 180;
  // Avoid dividing by zero at the equinoxes.
  const tanDec = Math.tan((Math.abs(sun.lat) < 0.01 ? (sun.lat < 0 ? -0.01 : 0.01) : sun.lat) * r);
  const ring: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const lat = Math.atan(-Math.cos((lng - sun.lng) * r) / tanDec) / r;
    ring.push([lng, Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, lat))]);
  }
  const pole = sun.lat > 0 ? -MERCATOR_LIMIT : MERCATOR_LIMIT;
  ring.push([180, pole], [-180, pole]);
  return ring;
}
