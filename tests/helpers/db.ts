import {openDb, runMigrations, type Db} from '../../src/db/client.ts';
import type {RoundArtifact} from '../../src/types.ts';

/**
 * A migrated in-memory database per test. Nothing here can reach the operator's
 * real review store, and no test can see another's rows.
 */
export function testDb(): Db {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

/**
 * An artifact with sensible defaults, so a test overrides only the field it is
 * about. A fixture with every field spelled out buries the one line that
 * matters.
 */
export function artifact(overrides: Partial<RoundArtifact> = {}): RoundArtifact {
  return {
    repo: 'octo/hello',
    pr: 42,
    headSha: 'abc1234',
    verdict: 'comment',
    summary: 'Looks broadly fine.',
    findings: [],
    ...overrides,
  };
}

/** One finding, defaulted. Pass what the test is asserting on. */
export function finding(overrides: Partial<RoundArtifact['findings'][number]> = {}) {
  return {
    file: 'src/thing.ts',
    line: 10,
    tier: 'T2' as const,
    title: 'Unhandled error path',
    body: 'The catch drops the cause.',
    evidence: 'catch (e) { return null; }',
    ...overrides,
  };
}
