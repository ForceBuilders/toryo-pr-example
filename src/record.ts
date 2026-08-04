import {and, eq} from 'drizzle-orm';
import type {Db} from './db/client.ts';
import {target, round, finding, type FindingRow} from './db/schema.ts';
import {findingId} from './finding-id.ts';
import type {RecordInput, Resolution, RoundCounts} from './types.ts';

export type RecordResult = {
  targetId: string;
  round: number;
  counts: RoundCounts;
};

/**
 * Record one review round against a PR, chaining it to everything seen before.
 *
 * The whole point of this function is the four-way resolution it computes, and
 * the one thing it refuses to touch:
 *
 * | incoming? | seen before? | present last round? | resolution      |
 * |---|---|---|---|
 * | yes | no  | –   | `new`            |
 * | yes | yes | yes | `not_addressed`  |
 * | yes | yes | no  | `regressed`      |
 * | no  | yes | yes | `addressed`      |
 *
 * **Disposition is never recomputed.** A finding the operator ignored in round 1
 * comes back from the agent in round 2 (it is still in the code, after all) and
 * keeps its `ignored` disposition. Without that, triage would be Sisyphean: the
 * same dismissed finding would demand a decision on every single re-review.
 *
 * Everything runs in one transaction, so a crash halfway through cannot leave a
 * target claiming a round that has no findings.
 */
export function record(db: Db, input: RecordInput): RecordResult {
  return db.transaction(function (tx) {
    const now = new Date().toISOString();
    const existing = tx.select().from(target).where(and(eq(target.repo, input.repo), eq(target.pr, input.pr))).get();

    const nextRound = (existing?.latestRound ?? 0) + 1;
    const targetId = existing
      ? existing.id
      : tx
          .insert(target)
          .values({repo: input.repo, pr: input.pr, latestRound: 0})
          .returning()
          .get().id;

    tx.update(target)
      .set({
        projectId: input.projectId ?? existing?.projectId ?? null,
        title: input.title ?? existing?.title ?? null,
        author: input.author ?? existing?.author ?? null,
        baseRef: input.baseRef ?? existing?.baseRef ?? null,
        headRef: input.headRef ?? existing?.headRef ?? null,
        latestRound: nextRound,
        latestVerdict: input.verdict,
        latestSummaryMd: input.summary,
        updatedAt: now,
      })
      .where(eq(target.id, targetId))
      .run();

    const priorRows = tx.select().from(finding).where(eq(finding.targetId, targetId)).all();
    const prior = new Map(priorRows.map((row) => [row.findingId, row]));

    const counts: RoundCounts = {new: 0, not_addressed: 0, regressed: 0, addressed: 0};
    const seenThisRound = new Set<string>();

    for (const incoming of input.findings) {
      const id = findingId(incoming);
      // Two findings hashing the same within one round are the same finding
      // said twice. Keep the first and move on rather than writing both.
      if (seenThisRound.has(id)) continue;
      seenThisRound.add(id);

      const before = prior.get(id);
      const resolution = resolutionFor(before);
      counts[resolution] += 1;

      const raw = {
        file: incoming.file,
        line: incoming.line ?? null,
        tier: incoming.tier,
        title: incoming.title,
        bodyMd: incoming.body,
        evidence: incoming.evidence ?? '',
      };

      if (!before) {
        tx.insert(finding)
          .values({
            ...raw,
            targetId,
            findingId: id,
            resolution,
            present: true,
            firstSeenRound: nextRound,
            lastSeenRound: nextRound,
          })
          .run();
        continue;
      }

      // Raw columns only. `disposition`, `bodyOverrideMd` and `firstSeenRound`
      // are the operator's and the history's. The agent does not get to
      // overwrite them by running again.
      tx.update(finding)
        .set({...raw, resolution, present: true, lastSeenRound: nextRound, updatedAt: now})
        .where(eq(finding.id, before.id))
        .run();
    }

    for (const [id, row] of prior) {
      if (seenThisRound.has(id)) continue;
      if (row.present) counts.addressed += 1;
      tx.update(finding)
        .set({resolution: 'addressed', present: false, updatedAt: now})
        .where(eq(finding.id, row.id))
        .run();
    }

    tx.insert(round)
      .values({
        targetId,
        round: nextRound,
        headSha: input.headSha,
        verdict: input.verdict,
        summaryMd: input.summary,
        countsJson: JSON.stringify(counts),
      })
      .run();

    return {targetId, round: nextRound, counts};
  });
}

/**
 * A finding absent from the store is `new`. One that was in the last round and
 * is still here was `not_addressed`. One that had disappeared and came back is a
 * `regression`, worth distinguishing because it usually means a fix was
 * reverted or a merge undid it.
 */
function resolutionFor(before: FindingRow | undefined): Resolution {
  if (!before) return 'new';
  return before.present ? 'not_addressed' : 'regressed';
}
