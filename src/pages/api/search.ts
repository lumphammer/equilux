import type { APIRoute } from 'astro';
import { searchPlaces, visitorLocation } from '../../lib/places.server.ts';

export const GET: APIRoute = async ({ url, request }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 100);
  const results = await searchPlaces(q, visitorLocation(request).country);
  return Response.json(
    { results },
    { headers: { 'Cache-Control': 'public, max-age=3600', Vary: 'CF-IPCountry' } },
  );
};
