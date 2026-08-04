import {eq} from 'drizzle-orm';
import type {Db} from './db/client.ts';
import {finding} from './db/schema.ts';
import {postReview} from './gh.ts';
import {getFindingById, getTargetById, pendingFindings, toView} from './queries.ts';
import type {Disposition, FindingView} from './types.ts';

export type TriageResult<T> = {ok: true; value: T} | {ok: false; message: string};

/**
 * Set a finding's disposition. This is the operator's verdict, and `record()`
 * carries it forward untouched through every later round.
 */
export function dispose(db: Db, id: string, disposition: Disposition): TriageResult<FindingView> {
  const row = getFindingById(db, id);
  if (!row) return {ok: false, message: `no finding ${id}`};

  db.update(finding)
    .set({disposition, updatedAt: new Date().toISOString()})
    .where(eq(finding.id, id))
    .run();

  const fresh = getFindingById(db, id);
  return fresh ? {ok: true, value: toView(fresh)} : {ok: false, message: `no finding ${id}`};
}

/**
 * Rewrite a finding's body.
 *
 * Written to `bodyOverrideMd`, never to `bodyMd`. Two reasons, and both bite in
 * practice: the next review round rewrites every raw column, so an edit stored
 * in `bodyMd` would be silently destroyed; and `bodyMd` is not part of the
 * content hash, but keeping the raw text pristine means the edit provably
 * cannot affect identity.
 *
 * Passing null clears the edit and reverts to what the agent wrote.
 */
export function editBody(db: Db, id: string, body: string | null): TriageResult<FindingView> {
  const row = getFindingById(db, id);
  if (!row) return {ok: false, message: `no finding ${id}`};

  db.update(finding)
    .set({bodyOverrideMd: body, updatedAt: new Date().toISOString()})
    .where(eq(finding.id, id))
    .run();

  const fresh = getFindingById(db, id);
  return fresh ? {ok: true, value: toView(fresh)} : {ok: false, message: `no finding ${id}`};
}

/**
 * Post findings to GitHub as one review, then mark them `posted`.
 *
 * Order matters: GitHub first, database second. If the API call fails nothing is
 * marked, so a retry posts the same set again. The opposite order would mark
 * findings as posted that never left the building, and no amount of retrying
 * would fix it.
 */
export async function postFindings(
  db: Db,
  targetId: string,
  ids?: string[],
): Promise<TriageResult<{posted: number; inline: number}>> {
  const target = getTargetById(db, targetId);
  if (!target) return {ok: false, message: `no target ${targetId}`};

  const chosen = ids?.length
    ? ids.map((id) => getFindingById(db, id)).filter((r) => r !== undefined).map(toView)
    : pendingFindings(db, targetId);

  if (chosen.length === 0) return {ok: false, message: 'no findings to post'};

  const sent = await postReview({
    repo: target.repo,
    pr: target.pr,
    findings: chosen,
    intro: target.latestSummaryMd ?? undefined,
  });
  if (!sent.ok) return {ok: false, message: sent.message};

  const now = new Date().toISOString();
  for (const f of chosen) {
    db.update(finding).set({disposition: 'posted', postedAt: now, updatedAt: now}).where(eq(finding.id, f.id)).run();
  }

  return {ok: true, value: sent.value};
}
