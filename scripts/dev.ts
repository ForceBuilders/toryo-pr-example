#!/usr/bin/env bun
/**
 * Run the API and the Vite dev server together, and make Ctrl-C stop both.
 *
 * A `&` in a package.json script leaves the backgrounded half orphaned when the
 * foreground one dies, which is how you end up with a stale server holding port
 * 8787 after every restart.
 */
const children = [
  Bun.spawn(['bun', '--hot', 'src/server.ts'], {stdio: ['ignore', 'inherit', 'inherit']}),
  Bun.spawn(['bunx', 'vite'], {stdio: ['ignore', 'inherit', 'inherit']}),
];

function stopAll(): void {
  for (const child of children) child.kill();
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

// If either half exits on its own, the other is useless: take both down so the
// failure is visible instead of half a working app.
await Promise.race(children.map((c) => c.exited));
stopAll();
