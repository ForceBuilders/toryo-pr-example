import {homedir} from 'node:os';
import {join} from 'node:path';
import {defineConfig} from 'drizzle-kit';

/**
 * Migrations are generated (`bun run db:generate`), never hand-written: the
 * generator maintains the journal and snapshots the runner depends on, and a
 * hand-rolled .sql file is invisible to both.
 *
 * The db path is duplicated from `src/db/client.ts` rather than imported.
 * drizzle-kit runs under node in CJS, so importing anything that reaches
 * `bun:sqlite` fails at config load. Six lines of duplication beats a config
 * that cannot be loaded.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.PR_EXAMPLE_DB ?? join(homedir(), '.toryo-pr-example', 'reviews.db'),
  },
});
