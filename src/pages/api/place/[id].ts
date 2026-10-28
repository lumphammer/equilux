import type { APIRoute } from 'astro';
import { findPlace } from '../../../lib/places.server.ts';

export const GET: APIRoute = async ({ params }) => {
  const place = await findPlace(Number(params.id));
  if (!place) return Response.json({ error: 'No such place' }, { status: 404 });
  return Response.json({ place }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
};
