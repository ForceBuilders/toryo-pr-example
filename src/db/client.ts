import {Database} from 'bun:sqlite';
import {homedir} from 'node:os';
import {mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {drizzle, type BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite';
import {migrate} from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema.ts';

export type Db = BunSQLiteDatabase<typeof schema>;

/**
 * One SQLite file, outside the repo so a clone is never a database.
 *
 * `PR_EXAMPLE_DB` overrides it, which is what the tests use — every one of them
 * runs against `:memory:` rather than a shared file, so a test run can never
 * touch the operator's real reviews.
 */
export function dbPath(): string {
  return process.env.PR_EXAMPLE_DB ?? join(homedir(), '.toryo-pr-example', 'reviews.db');
}

export function openDb(path = dbPath()): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true});
  const sqlite = new Database(path, {create: true});
  // WAL so the CLI and the server can hold the file open at the same time;
  // foreign keys because SQLite leaves them off and the cascade matters.
  if (path !== ':memory:') sqlite.run('PRAGMA journal_mode = WAL;');
  sqlite.run('PRAGMA foreign_keys = ON;');
  return drizzle(sqlite, {schema});
}

export function runMigrations(db: Db): void {
  migrate(db, {migrationsFolder: join(import.meta.dir, '..', '..', 'migrations')});
}

/** Open + migrate in one call. The server and every CLI command start here. */
export function connect(path = dbPath()): Db {
  const db = openDb(path);
  runMigrations(db);
  return db;
}
