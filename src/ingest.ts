import {join} from 'node:path';
import type {Db} from './db/client.ts';
import {record, type RecordResult} from './record.ts';
import {isTerminal, runDir, runStatus, type SequenceRun} from './toryo.ts';
import {roundArtifactSchema} from './types.ts';

export const ARTIFACT_BASENAME = 'findings.json';

export type IngestOutcome =
  | {kind: 'recorded'; result: RecordResult; repo: string; pr: number}
  | {kind: 'pending'; status: SequenceRun['status']; currentStep: string | null}
  | {kind: 'failed'; message: string};

/**
 * Pull a finished run's artifact into the store.
 *
 * This is the seam between the two halves of the system, and it is deliberately
 * a **pull, not a push**. The sequence writes a file and exits; it does not know
 * this app exists, has no credentials for it, and does not care whether it is
 * running. Everything the app needs is on disk in the run directory afterwards.
 *
 * The alternative (a final worker step that calls back into the app's CLI)
 * costs an extra agent session, couples the sequence to this app, and fails
 * silently when the app is not installed. A file is a better contract.
 *
 * Ingest is idempotent in the only sense that matters: calling it twice records
 * two rounds, and the second one chains onto the first with every finding
 * `not_addressed`. That is wrong but recoverable and visible, which beats a
 * partial write.
 */
export async function ingestRun(db: Db, runId: string): Promise<IngestOutcome> {
  const status = await runStatus(runId);
  if (!status.ok) return {kind: 'failed', message: status.message};

  const run = status.value;
  if (!isTerminal(run.status)) {
    return {kind: 'pending', status: run.status, currentStep: run.currentStep};
  }
  if (run.status !== 'succeeded') {
    return {kind: 'failed', message: run.error?.message ?? `run ${runId} ended ${run.status}`};
  }

  const path = join(runDir(run.projectId, runId), ARTIFACT_BASENAME);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return {kind: 'failed', message: `run ${runId} succeeded but wrote no ${ARTIFACT_BASENAME} (looked in ${path})`};
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch (error) {
    return {kind: 'failed', message: `${path} is not valid JSON: ${(error as Error).message}`};
  }

  const parsed = roundArtifactSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      kind: 'failed',
      message: `${path} does not match the artifact schema: ${first?.path.join('.')} ${first?.message}`,
    };
  }

  const result = record(db, {...parsed.data, projectId: run.projectId});
  return {kind: 'recorded', result, repo: parsed.data.repo, pr: parsed.data.pr};
}
