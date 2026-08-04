import {parsePrRef} from '../gh.ts';
import {startReview} from '../toryo.ts';
import {fail, json, readJson, type Route} from './route.ts';

type Body = {ref?: string; repo?: string; pr?: number; focus?: string; project?: string};

/**
 * Kick off a review.
 *
 * All this does is shell out to `toryo sequence run`. The app owns no queue, no
 * worker pool, and no model credentials — that is the entire argument for
 * building on toryo rather than beside it.
 */
export const startReviewRoute: Route = {
  method: 'POST',
  path: '/api/reviews',
  async handler(req) {
    const body = await readJson<Body>(req);
    if (!body) return fail('expected a JSON body', 400);

    const parsed = body.ref ? parsePrRef(body.ref) : null;
    const repo = parsed?.repo ?? body.repo;
    const pr = parsed?.pr ?? body.pr;
    if (!repo || !pr) {
      return fail('need a pull request: {ref: "owner/name#123"} or {repo, pr}', 400);
    }

    const project = body.project ?? process.env.PR_EXAMPLE_PROJECT;
    if (!project) {
      return fail('no toryo project: set PR_EXAMPLE_PROJECT or pass {project}', 400);
    }

    const started = await startReview({repo, pr, focus: body.focus, project});
    if (!started.ok) return fail(started.message, 502);

    return json({runId: started.value.runId, repo, pr});
  },
};
