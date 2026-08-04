import {join} from 'node:path';
import {connect, dbPath, type Db} from './db/client.ts';
import {toBunRoutes} from './routes/registry.ts';
import type {RouteContext} from './routes/route.ts';

const DEFAULT_PORT = 8787;

/**
 * The API. In development Vite serves the UI on 5173 and proxies `/api` here;
 * `bun start` serves the built assets from this process instead, so production
 * is one port and one process.
 */
export function createServer(opts: {db?: Db; port?: number} = {}) {
  const db = opts.db ?? connect();
  const ctx: RouteContext = {db, ingested: new Map()};
  const dist = join(import.meta.dir, '..', 'web', 'dist');

  return Bun.serve({
    port: opts.port ?? Number(process.env.PR_EXAMPLE_PORT ?? DEFAULT_PORT),
    routes: toBunRoutes(ctx),
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname.startsWith('/api/')) {
        return Response.json({error: `no route for ${req.method} ${url.pathname}`}, {status: 404});
      }

      // Static assets when built, falling back to index.html so the UI's
      // client-side view state survives a refresh.
      const asset = Bun.file(join(dist, url.pathname === '/' ? 'index.html' : url.pathname.slice(1)));
      if (await asset.exists()) return new Response(asset);

      const index = Bun.file(join(dist, 'index.html'));
      if (await index.exists()) return new Response(index);

      return new Response('Run `bun run dev` for the UI, or `bun run build` first.', {status: 404});
    },
  });
}

if (import.meta.main) {
  const server = createServer();
  process.stderr.write(`pr-example api on http://localhost:${server.port}\n`);
  process.stderr.write(`database ${dbPath()}\n`);
}
