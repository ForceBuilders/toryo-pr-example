import {getFindingById} from '../queries.ts';
import {postFindings} from '../triage.ts';
import {fail, json, type Route} from './route.ts';

/** Post a single finding to GitHub: the per-row "post" button in the UI. */
export const postFindingRoute: Route = {
  method: 'POST',
  path: '/api/findings/:id/post',
  async handler(_req, params, ctx) {
    const row = getFindingById(ctx.db, params.id!);
    if (!row) return fail(`no finding ${params.id}`, 404);

    const result = await postFindings(ctx.db, row.targetId, [row.id]);
    return result.ok ? json(result.value) : fail(result.message, 502);
  },
};
