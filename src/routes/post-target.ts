import {postFindings} from '../triage.ts';
import {fail, json, type Route} from './route.ts';

/**
 * Post every still-pending finding as one review: the "I agree with all of it"
 * path, and the reason `postReview` batches instead of posting per finding.
 */
export const postTargetRoute: Route = {
  method: 'POST',
  path: '/api/targets/:id/post',
  async handler(_req, params, ctx) {
    const result = await postFindings(ctx.db, params.id!);
    return result.ok ? json(result.value) : fail(result.message, 502);
  },
};
