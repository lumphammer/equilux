/**
 * Let browsers and Cloudflare cache a page briefly. Not in development, and
 * not for long: a cached page names the script bundles of the deploy it came
 * from, which vanish at the next deploy.
 */
export function cacheFor(response: { headers: Headers }, seconds: number) {
  if (import.meta.env.PROD) response.headers.set('Cache-Control', `public, max-age=${seconds}`);
}
