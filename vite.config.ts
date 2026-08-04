import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

/**
 * The UI lives in `web/`, the API in `src/`. In development Vite serves the
 * former and proxies `/api` to the latter, so the browser only ever talks to
 * one origin and there is no CORS story to get wrong.
 */
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwind()],
  server: {
    port: 5173,
    proxy: {'/api': {target: `http://localhost:${process.env.PR_EXAMPLE_PORT ?? 8787}`, changeOrigin: true}},
  },
  build: {outDir: 'dist', emptyOutDir: true},
});
