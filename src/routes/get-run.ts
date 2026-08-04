import {ingestRun, type IngestOutcome} from '../ingest.ts';
import {getTargetByPr} from '../queries.ts';
import {isTerminal, runStatus} from '../toryo.ts';
import {fail, json, type Route} from './route.ts';

/**
 * Poll a run, and pull its artifact in the moment it finishes.
 *
 * There is no background timer here: the UI's polling is what drives ingestion.
 * A timer would keep running after everyone stopped looking, and would need its
 * own lifecycle, error handling and shutdown path to do a job the foreground
 * poll already does. If nobody is watching, the artifact waits on disk and
 * `pr-example ingest --run <id>` collects it later.
 *
 * The in-flight ingest is memoised per run id, so two overlapping polls of the
 * same finished run record one round, not two.
 */
export const getRunRoute: Route = {
  method: 'GET',
  path: '/api/runs/:runId',
  async handler(_req, params, ctx) {
    const runId = params.runId!;
    const status = await runStatus(runId);
    if (!status.ok) return fail(status.message, status.code === 67 ? 404 : 502);

    const run = status.value;
    if (!isTerminal(run.status)) {
      return json({runId, status: run.status, currentStep: run.currentStep, target: null});
    }

    const existing = ctx.ingested.get(runId);
    const outcome = (await (existing ??
      (function () {
        const pending = ingestRun(ctx.db, runId);
        ctx.ingested.set(runId, pending);
        return pending;
      })())) as IngestOutcome;

    if (outcome.kind === 'failed') {
      return json({runId, status: run.status, currentStep: null, target: null, error: outcome.message});
    }
    if (outcome.kind === 'pending') {
      return json({runId, status: outcome.status, currentStep: outcome.currentStep, target: null});
    }

    const target = getTargetByPr(ctx.db, outcome.repo, outcome.pr);
    return json({
      runId,
      status: run.status,
      currentStep: null,
      round: outcome.result.round,
      counts: outcome.result.counts,
      target: target ?? null,
    });
  },
};
