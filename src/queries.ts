import {and, asc, desc, eq} from 'drizzle-orm';
import type {Db} from './db/client.ts';
import {target, round, finding, type FindingRow, type RoundRow, type TargetRow} from './db/schema.ts';
import type {Disposition, FindingView, Resolution, Tier} from './types.ts';

export type TargetDetail = {
  target: TargetRow;
  rounds: RoundRow[];
  findings: FindingView[];
};

export function listTargets(db: Db): TargetRow[] {
  return db.select().from(target).orderBy(desc(target.updatedAt)).all();
}

export function getTargetById(db: Db, id: string): TargetRow | undefined {
  return db.select().from(target).where(eq(target.id, id)).get();
}

export function getTargetByPr(db: Db, repo: string, pr: number): TargetRow | undefined {
  return db.select().from(target).where(and(eq(target.repo, repo), eq(target.pr, pr))).get();
}

/**
 * A target with everything the detail pane needs.
 *
 * `includeAddressed` defaults to false: a fixed finding is history, not work,
 * and leaving it in the default view buries the two or three things that still
 * need a decision.
 */
export function getTargetDetail(db: Db, id: string, opts: {includeAddressed?: boolean} = {}): TargetDetail | undefined {
  const row = getTargetById(db, id);
  if (!row) return undefined;

  const rounds = db.select().from(round).where(eq(round.targetId, id)).orderBy(asc(round.round)).all();
  const rows = db.select().from(finding).where(eq(finding.targetId, id)).all();
  const visible = opts.includeAddressed ? rows : rows.filter((f) => f.present);

  return {target: row, rounds, findings: visible.sort(bySeverityThenFile).map(toView)};
}

export function getFindingById(db: Db, id: string): FindingRow | undefined {
  return db.select().from(finding).where(eq(finding.id, id)).get();
}

/** Every finding still awaiting an operator decision, worst first. */
export function pendingFindings(db: Db, targetId: string): FindingView[] {
  return db
    .select()
    .from(finding)
    .where(and(eq(finding.targetId, targetId), eq(finding.disposition, 'pending')))
    .all()
    .filter((f) => f.present)
    .sort(bySeverityThenFile)
    .map(toView);
}

/**
 * Map a row to the wire shape, resolving the operator's edit over the raw text.
 *
 * Callers get `body` (what to show and post) and `rawBody` (what the agent
 * actually said) rather than having to know the override rule. One place knows
 * it; nothing downstream can get it wrong.
 */
export function toView(row: FindingRow): FindingView {
  return {
    id: row.id,
    findingId: row.findingId,
    file: row.file,
    line: row.line,
    tier: row.tier as Tier,
    title: row.title,
    body: row.bodyOverrideMd ?? row.bodyMd,
    edited: row.bodyOverrideMd !== null,
    rawBody: row.bodyMd,
    evidence: row.evidence,
    disposition: row.disposition as Disposition,
    resolution: row.resolution as Resolution,
    present: row.present,
    firstSeenRound: row.firstSeenRound,
    lastSeenRound: row.lastSeenRound,
    postedAt: row.postedAt,
  };
}

function bySeverityThenFile(a: FindingRow, b: FindingRow): number {
  if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
  return a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0);
}
