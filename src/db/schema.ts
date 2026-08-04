import {sqliteTable, text, integer, uniqueIndex, index} from 'drizzle-orm/sqlite-core';

/**
 * Three tables. A **target** is one pull request, a **round** is one review of
 * it, and a **finding** is one issue that survives across rounds.
 *
 * The shape that matters is the last one: findings hang off the target, not off
 * the round. If a finding belonged to a round, re-reviewing a PR would produce
 * a fresh disconnected set every time and nobody could answer "did they fix
 * it?". Hanging them off the target and keying on a stable content id is what
 * makes that question answerable. See `src/finding-id.ts`.
 */

function newId(): string {
  return crypto.randomUUID();
}

/** ISO 8601 UTC. Local time never enters the database; the UI formats it. */
function nowIso(): string {
  return new Date().toISOString();
}

export const target = sqliteTable(
  'target',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    repo: text('repo').notNull(),
    pr: integer('pr').notNull(),
    /**
     * The toryo project this PR belongs to, when there is one. A loose
     * reference: toryo owns the project registry in its own database, and this
     * app never joins across that boundary; it shells the CLI instead.
     */
    projectId: text('project_id'),
    title: text('title'),
    author: text('author'),
    baseRef: text('base_ref'),
    headRef: text('head_ref'),
    latestRound: integer('latest_round').notNull().default(0),
    latestVerdict: text('latest_verdict'),
    latestSummaryMd: text('latest_summary_md'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  function (t) {
    return {byRepoPr: uniqueIndex('target_repo_pr').on(t.repo, t.pr)};
  },
);

export const round = sqliteTable(
  'round',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    targetId: text('target_id')
      .notNull()
      .references(() => target.id, {onDelete: 'cascade'}),
    /** 1-based, assigned by `record()`. Immutable once written. */
    round: integer('round').notNull(),
    headSha: text('head_sha').notNull(),
    verdict: text('verdict').notNull(),
    summaryMd: text('summary_md').notNull().default(''),
    /** `RoundCounts` as JSON: how many findings were new / addressed / … */
    countsJson: text('counts_json').notNull().default('{}'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  function (t) {
    return {byTargetRound: uniqueIndex('round_target_round').on(t.targetId, t.round)};
  },
);

export const finding = sqliteTable(
  'finding',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    targetId: text('target_id')
      .notNull()
      .references(() => target.id, {onDelete: 'cascade'}),
    /** The stable content hash. Unique per target: this is the chaining key. */
    findingId: text('finding_id').notNull(),

    // Raw agent output. Rewritten on every round.
    file: text('file').notNull(),
    line: integer('line'),
    tier: text('tier').notNull(),
    title: text('title').notNull(),
    bodyMd: text('body_md').notNull(),
    evidence: text('evidence').notNull().default(''),

    /**
     * Operator edit, kept in a SEPARATE column rather than overwriting `bodyMd`.
     * Each round rewrites the raw columns, so an edit stored in `bodyMd` would
     * be silently destroyed by the next review. It also keeps the hashed input
     * untouched, so editing text cannot re-key the finding.
     */
    bodyOverrideMd: text('body_override_md'),

    disposition: text('disposition').notNull().default('pending'),
    resolution: text('resolution').notNull().default('new'),
    /** Whether the finding survived into the latest round. Stored as 0/1. */
    present: integer('present', {mode: 'boolean'}).notNull().default(true),
    firstSeenRound: integer('first_seen_round').notNull(),
    lastSeenRound: integer('last_seen_round').notNull(),
    postedAt: text('posted_at'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  function (t) {
    return {
      byTargetFinding: uniqueIndex('finding_target_finding').on(t.targetId, t.findingId),
      byTarget: index('finding_target').on(t.targetId),
    };
  },
);

export type TargetRow = typeof target.$inferSelect;
export type RoundRow = typeof round.$inferSelect;
export type FindingRow = typeof finding.$inferSelect;
