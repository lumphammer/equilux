import type { APIRoute } from 'astro';
import { parseCoordinates, pointPlace } from '../../lib/places.server.ts';

export const GET: APIRoute = async ({ url }) => {
  const at = parseCoordinates(url.searchParams.get('at') ?? '');
  if (!at) return Response.json({ error: 'Expected ?at=lat,lng' }, { status: 400 });
  return Response.json(
    { place: await pointPlace(at.lat, at.lng) },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
};
