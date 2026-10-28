// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';

export default defineConfig({
  output: 'server',
  // No server sessions or image transforms, so no KV or Images bindings
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  integrations: [preact()],
  vite: {
    optimizeDeps: {
      // MapLibre loads its own web worker, which pre-bundling breaks
      exclude: ['maplibre-gl'],
      // Found late otherwise, and the reload breaks the first request
      include: ['preact/devtools'],
    },
  },
});
